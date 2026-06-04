/**
 * DB integration test for the public Verify API meter. Hits the real DB.
 *   npm run test:integration:api
 * Creates a temp owner + key + verified agent, exercises auth / logging /
 * 404 / quota-429, then cleans up (owner delete cascades).
 */
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { closeDb, db } from "../src/db/index";
import { agents, apiKeys, owners, trustSignals, verificationCalls } from "../src/db/schema";
import { createApiKey } from "../src/lib/api-keys/service";
import { runVerify } from "../src/lib/api/verify";
import { TRUST_WEIGHTS } from "../src/lib/trust/weights";

const ownerIds: string[] = [];

async function setup() {
  const [owner] = await db
    .insert(owners)
    .values({ clerkUserId: `apitest_${Math.round(performance.now())}_${ownerIds.length}`, email: "api@test.dev" })
    .returning();
  ownerIds.push(owner.id);
  const slug = `apitest-${owner.id.slice(0, 8)}`;
  const [agent] = await db
    .insert(agents)
    .values({ ownerId: owner.id, name: "API Test", slug, domain: "example.com", verifiedDomain: "example.com", status: "key_verified", publicKey: "z6MkTEST", capabilities: ["tools/list"] })
    .returning();
  await db.insert(trustSignals).values({ agentId: agent.id, signalType: "domain_control", value: 1, weight: TRUST_WEIGHTS.domain_control });
  const { plaintext } = await createApiKey(owner.id, "test");
  return { owner, agent, slug, key: plaintext };
}

async function callCount(keyId: string) {
  const rows = await db.query.verificationCalls.findMany({ where: eq(verificationCalls.apiKeyId, keyId) });
  return rows.length;
}

after(async () => {
  for (const id of ownerIds) await db.delete(owners).where(eq(owners.id, id));
  await closeDb();
});

test("verify API: valid key + known agent → 200 with status + score, and logs one call", async () => {
  const { slug, key, owner } = await setup();
  const [keyRow] = await db.query.apiKeys.findMany({ where: eq(apiKeys.ownerId, owner.id) });
  const before = await callCount(keyRow.id);

  const r = await runVerify({ presentedKey: key, agentQuery: slug });
  assert.equal(r.status, 200);
  assert.equal((r.body.agent as { slug: string }).slug, slug);
  assert.equal(r.body.status, "key_verified");
  assert.equal((r.body.trust as { score: number }).score, Math.round(100 * TRUST_WEIGHTS.domain_control));
  assert.equal(r.body.verified, true);

  assert.equal(await callCount(keyRow.id), before + 1, "exactly one call logged");
  // Response must not leak private fields.
  assert.ok(!JSON.stringify(r.body).includes("@test.dev"), "no owner email leaked");
});

test("verify API: missing/invalid key → 401 and logs nothing", async () => {
  const { owner } = await setup();
  const r = await runVerify({ presentedKey: "ap_live_bogus", agentQuery: "whatever" });
  assert.equal(r.status, 401);
  const keys = await db.query.apiKeys.findMany({ where: eq(apiKeys.ownerId, owner.id) });
  // brand-new key for this owner has zero calls (the 401 used a bogus key)
  assert.equal(await callCount(keys[0].id), 0);
});

test("verify API: known key + unknown agent → 404, still logged", async () => {
  const { key, owner } = await setup();
  const [keyRow] = await db.query.apiKeys.findMany({ where: eq(apiKeys.ownerId, owner.id) });
  const r = await runVerify({ presentedKey: key, agentQuery: "no-such-agent-xyz" });
  assert.equal(r.status, 404);
  assert.equal(await callCount(keyRow.id), 1, "404 on a known key is logged");
});

test("verify API: free quota exceeded → 429 (with small quota override)", async () => {
  const { slug, key, owner } = await setup();
  const [keyRow] = await db.query.apiKeys.findMany({ where: eq(apiKeys.ownerId, owner.id) });
  // quota=2: two calls succeed, the third is blocked.
  const a = await runVerify({ presentedKey: key, agentQuery: slug, quota: 2 });
  const b = await runVerify({ presentedKey: key, agentQuery: slug, quota: 2 });
  const c = await runVerify({ presentedKey: key, agentQuery: slug, quota: 2 });
  assert.equal(a.status, 200);
  assert.equal(b.status, 200);
  assert.equal(c.status, 429);
  assert.equal(c.body.quota, 2);
  assert.equal(await callCount(keyRow.id), 3, "all three calls logged incl. the 429");
});
