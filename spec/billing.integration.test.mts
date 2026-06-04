/**
 * DB integration: atomic quota meter + Stripe checkout/webhook (mocked client).
 *   npm run test:integration:billing
 * Uses dummy Stripe creds for local signature verification; no network/charge.
 */
process.env.STRIPE_SECRET_KEY ||= "sk_test_dummy";
process.env.STRIPE_WEBHOOK_SECRET ||= "whsec_dummytestsecret";
process.env.STRIPE_PRICE_PRO ||= "price_pro_test";

import { test, after } from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { closeDb, db } from "../src/db/index";
import { agents, owners } from "../src/db/schema";
import { runVerify } from "../src/lib/api/verify";
import { createApiKey } from "../src/lib/api-keys/service";
import { createCheckoutSession, type StripeLike } from "../src/lib/billing/service";
import { constructStripeEvent, routeStripeEvent } from "../src/lib/billing/webhook";
import { getStripe } from "../src/lib/billing/stripe";

const ownerIds: string[] = [];
after(async () => {
  for (const id of ownerIds) await db.delete(owners).where(eq(owners.id, id));
  await closeDb();
});
async function mkOwner(over: Partial<typeof owners.$inferInsert> = {}) {
  const [o] = await db.insert(owners).values({ clerkUserId: `bill_${Math.round(performance.now())}_${ownerIds.length}`, email: "b@test.dev", ...over }).returning();
  ownerIds.push(o.id);
  return o;
}

test("atomic quota: N concurrent calls at quota K → exactly K granted (AC-a)", async () => {
  const owner = await mkOwner();
  const { plaintext } = await createApiKey(owner.id, "k");
  const [agent] = await db.insert(agents).values({ ownerId: owner.id, name: "Q", slug: `q-${owner.id.slice(0, 8)}`, domain: "example.com", verifiedDomain: "example.com", status: "key_verified" }).returning();

  const N = 8;
  const K = 3;
  const results = await Promise.all(
    Array.from({ length: N }, () => runVerify({ presentedKey: plaintext, agentQuery: agent.slug, quota: K })),
  );
  const ok = results.filter((r) => r.status === 200).length;
  const limited = results.filter((r) => r.status === 429).length;
  assert.equal(ok, K, "exactly K granted under concurrency (no TOCTOU over-grant)");
  assert.equal(limited, N - K, "the rest are 429");
});

test("checkout: builds a subscription session with the plan price (AC-c)", async () => {
  const owner = await mkOwner({ stripeCustomerId: "cus_existing" });
  const calls: Record<string, unknown>[] = [];
  const mock: StripeLike = {
    customers: { create: async () => ({ id: "cus_new" }) },
    checkout: { sessions: { create: async (a) => { calls.push(a); return { url: "https://checkout.test/s" }; } } },
    billingPortal: { sessions: { create: async () => ({ url: "https://portal.test" }) } },
  };
  const url = await createCheckoutSession(owner, "pro", { successUrl: "https://app/ok", cancelUrl: "https://app/no" }, mock);
  assert.equal(url, "https://checkout.test/s");
  assert.equal(calls[0].mode, "subscription");
  assert.equal(calls[0].customer, "cus_existing");
  assert.deepEqual(calls[0].line_items, [{ price: "price_pro_test", quantity: 1 }]);
});

test("webhook: signature verified; subscription events drive plan (AC-d)", async () => {
  const owner = await mkOwner({ stripeCustomerId: "cus_wh", planTier: "free" });
  const stripe = getStripe();

  const made = (type: string, status: string) => ({
    id: "evt", type, data: { object: { customer: "cus_wh", status, items: { data: [{ price: { id: "price_pro_test" } }] } } },
  });

  // Bad signature → constructStripeEvent throws.
  assert.throws(() => constructStripeEvent(JSON.stringify(made("customer.subscription.created", "active")), "t=1,v1=bad"));

  // Valid signature round-trips.
  const payload = JSON.stringify(made("customer.subscription.created", "active"));
  const header = stripe.webhooks.generateTestHeaderString({ payload, secret: process.env.STRIPE_WEBHOOK_SECRET! });
  const event = constructStripeEvent(payload, header);
  assert.equal(event.type, "customer.subscription.created");

  // created/active → pro
  await routeStripeEvent(made("customer.subscription.created", "active"));
  let o = await db.query.owners.findFirst({ where: eq(owners.id, owner.id) });
  assert.equal(o?.planTier, "pro");

  // deleted → free
  await routeStripeEvent(made("customer.subscription.deleted", "canceled"));
  o = await db.query.owners.findFirst({ where: eq(owners.id, owner.id) });
  assert.equal(o?.planTier, "free");
});
