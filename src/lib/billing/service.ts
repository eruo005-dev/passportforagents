import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { owners } from "@/db/schema";
import { getStripe } from "./stripe";
import { planToPriceId, priceIdToPlan, type PlanTier } from "./plans";

/** Minimal structural slice of Stripe we use — keeps tests trivially mockable. */
export type StripeLike = {
  customers: { create(args: Record<string, unknown>): Promise<{ id: string }> };
  checkout: { sessions: { create(args: Record<string, unknown>): Promise<{ url: string | null }> } };
  billingPortal: { sessions: { create(args: Record<string, unknown>): Promise<{ url: string }> } };
};

type Owner = typeof owners.$inferSelect;

const stripeClient = (s?: StripeLike): StripeLike => s ?? (getStripe() as unknown as StripeLike);

/** Ensure the owner has a Stripe customer; create + persist one if missing. */
export async function ensureStripeCustomer(owner: Owner, s?: StripeLike): Promise<string> {
  if (owner.stripeCustomerId) return owner.stripeCustomerId;
  const stripe = stripeClient(s);
  const customer = await stripe.customers.create({
    email: owner.email,
    metadata: { ownerId: owner.id },
  });
  await db.update(owners).set({ stripeCustomerId: customer.id }).where(eq(owners.id, owner.id));
  return customer.id;
}

/** Create a Stripe Checkout session for a paid plan; returns the redirect URL. */
export async function createCheckoutSession(
  owner: Owner,
  tier: PlanTier,
  urls: { successUrl: string; cancelUrl: string },
  s?: StripeLike,
): Promise<string> {
  const priceId = planToPriceId(tier);
  if (!priceId) throw new Error(`No Stripe price configured for plan "${tier}"`);
  const stripe = stripeClient(s);
  const customer = await ensureStripeCustomer(owner, stripe);
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: urls.successUrl,
    cancel_url: urls.cancelUrl,
    allow_promotion_codes: true,
    metadata: { ownerId: owner.id, tier },
  });
  if (!session.url) throw new Error("Stripe did not return a checkout URL");
  return session.url;
}

/** Create a Stripe Billing Portal session; returns the redirect URL. */
export async function createPortalSession(
  owner: Owner,
  returnUrl: string,
  s?: StripeLike,
): Promise<string> {
  const stripe = stripeClient(s);
  const customer = await ensureStripeCustomer(owner, stripe);
  const session = await stripe.billingPortal.sessions.create({ customer, return_url: returnUrl });
  return session.url;
}

/**
 * Apply a subscription state change to the owner's plan. Resolves the owner by
 * stripeCustomerId. Canceled/deleted → downgrade to free. Unknown price → no-op
 * (logged by caller), never wrongly downgrades.
 */
export async function applySubscription(args: {
  customerId: string;
  priceId: string | null;
  canceled: boolean;
}): Promise<{ ownerId: string; tier: PlanTier } | null> {
  const owner = await db.query.owners.findFirst({
    where: eq(owners.stripeCustomerId, args.customerId),
  });
  if (!owner) return null;

  let tier: PlanTier;
  if (args.canceled) {
    tier = "free";
  } else {
    const mapped = priceIdToPlan(args.priceId);
    if (!mapped) return null; // unknown price → don't touch the plan
    tier = mapped;
  }
  await db.update(owners).set({ planTier: tier }).where(eq(owners.id, owner.id));
  return { ownerId: owner.id, tier };
}
