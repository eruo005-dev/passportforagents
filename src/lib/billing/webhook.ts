import "server-only";
import type Stripe from "stripe";
import { getStripe } from "./stripe";
import { applySubscription } from "./service";

/** Verify + parse a Stripe webhook (throws on bad signature). */
export function constructStripeEvent(rawBody: string, signature: string): Stripe.Event {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET is not set");
  return getStripe().webhooks.constructEvent(rawBody, signature, secret);
}

type SubLike = {
  customer?: string | { id?: string };
  status?: string;
  items?: { data?: Array<{ price?: { id?: string } }> };
};

export type StripeEventLike = { type: string; data: { object: unknown } };

/**
 * Apply a (already-verified) Stripe event to owner billing state. Pure of
 * signature concerns → unit-testable with fabricated events. Handles
 * subscription created/updated/deleted; ignores everything else.
 */
export async function routeStripeEvent(
  event: StripeEventLike,
): Promise<{ handled: boolean; tier?: string }> {
  if (event.type.startsWith("customer.subscription.")) {
    const sub = event.data.object as SubLike;
    const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
    if (!customerId) return { handled: true };
    const priceId = sub.items?.data?.[0]?.price?.id ?? null;
    const canceled =
      event.type === "customer.subscription.deleted" ||
      sub.status === "canceled" ||
      sub.status === "incomplete_expired";
    const r = await applySubscription({ customerId, priceId, canceled });
    return { handled: true, tier: r?.tier };
  }
  return { handled: false };
}
