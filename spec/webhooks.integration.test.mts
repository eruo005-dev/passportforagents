/**
 * DB integration test for webhook delivery + the freshness sweep. Hits the dev DB.
 *   npm run test:integration:webhooks
 * Creates a temp owner + endpoint + stale agent, runs the sweep with a mock
 * fetch, asserts the change-only firing + HMAC delivery, then cleans up.
 */
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { closeDb, db } from "../src/db/index";
import { agents, owners, verifications, webhookEndpoints } from "../src/db/schema";
import { deliverWebhook, registerWebhook, runFreshnessSweep } from "../src/lib/webhooks/service";
import { verifySignature, SIGNATURE_HEADER } from "../src/lib/webhooks/sign";

const ownerIds: string[] = [];
after(async () => {
  for (const id of ownerIds) await db.delete(owners).where(eq(owners.id, id));
  await closeDb();
});

async function newOwner() {
  const [o] = await db
    .insert(owners)
    .values({ clerkUserId: `wh_${Math.round(performance.now())}_${ownerIds.length}`, email: "wh@test.dev" })
    .returning();
  ownerIds.push(o.id);
  return o;
}

// A mock fetch that records calls and returns a chosen status.
function recordingFetch(status = 200) {
  const calls: { url: string; body: string; sig: string }[] = [];
  const fn = async (url: string, init?: RequestInit) => {
    const h = init?.headers as Record<string, string>;
    calls.push({ url, body: String(init?.body ?? ""), sig: h?.[SIGNATURE_HEADER] ?? "" });
    return new Response("", { status });
  };
  return { fn, calls };
}

test("deliverWebhook signs the payload and reports success/failure", async () => {
  const o = await newOwner();
  const { endpoint, secret } = await registerWebhook(o.id, "https://example.com/hook");

  const ok = recordingFetch(200);
  const event = { type: "agent.freshness_changed", state: "stale" as const };
  const delivered = await deliverWebhook(endpoint, event, { fetchImpl: ok.fn, delayMs: 0 });
  assert.equal(delivered, true);
  assert.equal(ok.calls.length, 1);
  // The HMAC header verifies against the secret + body.
  assert.equal(verifySignature(secret, ok.calls[0].body, ok.calls[0].sig), true);

  const fail = recordingFetch(500);
  const delivered2 = await deliverWebhook(endpoint, event, { fetchImpl: fail.fn, delayMs: 0, attempts: 2 });
  assert.equal(delivered2, false);
  assert.equal(fail.calls.length, 2, "retried up to the attempt cap");
  const reloaded = await db.query.webhookEndpoints.findFirst({ where: eq(webhookEndpoints.id, endpoint.id) });
  assert.match(reloaded?.lastStatus ?? "", /http_500/);
});

test("freshness sweep fires only on change (idempotent)", async () => {
  const o = await newOwner();
  await registerWebhook(o.id, "https://example.com/hook");
  const [agent] = await db
    .insert(agents)
    .values({ ownerId: o.id, name: "Stale", slug: `stale-${o.id.slice(0, 8)}`, domain: "example.com", status: "key_verified" })
    .returning();
  // A successful verification that expired yesterday → should be "stale".
  await db.insert(verifications).values({
    agentId: agent.id,
    method: "well_known",
    verifiedAt: new Date("2026-05-01T00:00:00Z"),
    expiresAt: new Date("2026-05-31T00:00:00Z"),
  });

  const now = new Date("2026-06-04T12:00:00Z");
  const rec = recordingFetch(200);

  const first = await runFreshnessSweep({ now, fetchImpl: rec.fn, delayMs: 0 });
  assert.equal(first.changed >= 1, true);
  assert.equal(first.delivered >= 1, true);
  const a1 = await db.query.agents.findFirst({ where: eq(agents.id, agent.id) });
  assert.equal(a1?.freshnessState, "stale");
  const callsAfterFirst = rec.calls.length;

  // Re-run with the same time → no change → no new deliveries.
  const second = await runFreshnessSweep({ now, fetchImpl: rec.fn, delayMs: 0 });
  // (other temp agents from concurrent tests may exist; assert OUR agent didn't refire)
  assert.equal(rec.calls.length, callsAfterFirst, "no duplicate delivery when state is unchanged");
  assert.equal(second.checked >= 1, true);
});
