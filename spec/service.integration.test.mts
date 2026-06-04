/**
 * DB integration test for the verification persistence path.
 * Hits the real database, so it is NOT part of `npm test`. Run with:
 *   npm run test:integration
 * (env is loaded via --env-file=.env.local in the script).
 *
 * Creates a temporary owner + agent, runs verifyWellKnown with a mocked fetch
 * serving the signed fixture, and asserts the agent reaches key_verified with
 * trust-signal rows written. Cleans up after itself (owner delete cascades).
 */
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { and, eq } from "drizzle-orm";
import { closeDb, db } from "../src/db/index";
import { agents, owners, trustSignals, verifications } from "../src/db/schema";
import { pendingChallengeToken, runSecretHygieneScan, verifyWellKnown } from "../src/lib/verification/service";

const here = dirname(fileURLToPath(import.meta.url));
const valid = JSON.parse(readFileSync(join(here, "fixtures", "agent-passport.json"), "utf8"));
const tampered = JSON.parse(readFileSync(join(here, "fixtures", "agent-passport.tampered.json"), "utf8"));

const mockFetch =
  (doc: unknown): ((i: string, init?: RequestInit) => Promise<Response>) =>
  async () =>
    new Response(JSON.stringify(doc), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

const ownerIds: string[] = [];

async function makeAgent(domain: string) {
  const [owner] = await db
    .insert(owners)
    .values({ clerkUserId: `test_${Math.round(performance.now())}_${ownerIds.length}`, email: "t@test.dev" })
    .returning();
  ownerIds.push(owner.id);
  const [agent] = await db
    .insert(agents)
    .values({ ownerId: owner.id, name: "Test", slug: `test-${owner.id}`, domain, status: "unverified" })
    .returning();
  return agent;
}

after(async () => {
  for (const id of ownerIds) {
    await db.delete(owners).where(eq(owners.id, id)); // cascades to agents/verifs/signals
  }
  await closeDb(); // release the pool so the test process exits
});

test("verifyWellKnown persists key_verified + trust signals for a valid passport", async () => {
  const agent = await makeAgent("example.com");
  const result = await verifyWellKnown(agent.id, "example.com", mockFetch(valid));
  assert.equal(result.valid, true);

  const updated = await db.query.agents.findFirst({ where: eq(agents.id, agent.id) });
  assert.equal(updated?.status, "key_verified");
  assert.ok(updated?.publicKey, "public_key mirrored");
  assert.equal(updated?.capabilities?.length, 3);
  assert.equal(updated?.verifiedDomain, "example.com");

  const signals = await db.query.trustSignals.findMany({ where: eq(trustSignals.agentId, agent.id) });
  const types = signals.map((s) => s.signalType).sort();
  assert.deepEqual(types, ["domain_control", "signed_provenance"]);

  const verifRows = await db.query.verifications.findMany({
    where: and(eq(verifications.agentId, agent.id), eq(verifications.method, "well_known")),
  });
  assert.ok(verifRows.some((v) => v.verifiedAt), "a verified well_known row exists");
});

test("DNS challenge token survives a well_known verification (token-poisoning regression)", async () => {
  const agent = await makeAgent("example.com");
  // Simulate the claim-time DNS token row.
  await db
    .insert(verifications)
    .values({ agentId: agent.id, method: "dns_txt", challengeToken: "claimtok123" });
  // A well_known verify inserts a row with NO token — must not poison the lookup.
  await verifyWellKnown(agent.id, "example.com", mockFetch(valid));
  const tok = await pendingChallengeToken(agent.id);
  assert.equal(tok, "claimtok123");
});

test("runSecretHygieneScan writes secret_hygiene signal (exposed=0, clean=1)", async () => {
  const exposedAgent = await makeAgent("example.com");
  const exposedFetch = async (url: string) =>
    new URL(url).pathname === "/.env"
      ? new Response("API_KEY=sk_live_leaked123456", { status: 200 })
      : new Response("", { status: 404 });
  await runSecretHygieneScan(exposedAgent.id, exposedFetch);
  const exposedSig = await db.query.trustSignals.findMany({
    where: and(eq(trustSignals.agentId, exposedAgent.id), eq(trustSignals.signalType, "secret_hygiene")),
  });
  assert.equal(exposedSig[0]?.value, 0, "exposed secret → 0");

  const cleanAgent = await makeAgent("example.com");
  const cleanFetch = async () => new Response("", { status: 404 });
  await runSecretHygieneScan(cleanAgent.id, cleanFetch);
  const cleanSig = await db.query.trustSignals.findMany({
    where: and(eq(trustSignals.agentId, cleanAgent.id), eq(trustSignals.signalType, "secret_hygiene")),
  });
  assert.equal(cleanSig[0]?.value, 1, "clean scan → 1");
});

test("verifyWellKnown leaves status unverified for a tampered passport", async () => {
  const agent = await makeAgent("example.com");
  const result = await verifyWellKnown(agent.id, "example.com", mockFetch(tampered));
  assert.equal(result.valid, false);

  const updated = await db.query.agents.findFirst({ where: eq(agents.id, agent.id) });
  assert.equal(updated?.status, "unverified");
  assert.equal(updated?.publicKey, null);
});
