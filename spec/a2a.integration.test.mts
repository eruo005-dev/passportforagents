/**
 * DB integration test for A2A card verify → map → Verify API. Hits the dev DB.
 *   npm run test:integration:a2a
 * Creates a temp owner + agent + API key, serves a signed A2A card via a mock
 * fetch, verifies+maps it, and confirms it surfaces through runVerify. Cleans up.
 */
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, sign as nodeSign } from "node:crypto";
import { eq } from "drizzle-orm";
import { closeDb, db } from "../src/db/index";
import { agents, owners, trustSignals, verifications } from "../src/db/schema";
import { a2aSigningPayload, type A2AAgentCard } from "../src/lib/a2a/card";
import { verifyA2AForAgent } from "../src/lib/verification/service";
import { createApiKey } from "../src/lib/api-keys/service";
import { runVerify } from "../src/lib/api/verify";

const b64url = (b: Buffer | Uint8Array) =>
  Buffer.from(b).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const ownerIds: string[] = [];
after(async () => {
  for (const id of ownerIds) await db.delete(owners).where(eq(owners.id, id));
  await closeDb();
});

function signedCardFetch() {
  const { publicKey, privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
  const jwk = { ...publicKey.export({ format: "jwk" }), kid: "k1" };
  const card: A2AAgentCard = {
    name: "Mapped A2A Agent",
    version: "1.0.0",
    provider: { url: "https://example.com", organization: "Example" },
    skills: [{ id: "search", name: "Search" }, { id: "summarize", name: "Summarize" }],
  };
  const payload = a2aSigningPayload(card);
  const ph = b64url(Buffer.from(JSON.stringify({ alg: "ES256", kid: "k1", jku: "https://example.com/jwks.json", typ: "JOSE" })));
  const sig = nodeSign("sha256", Buffer.from(`${ph}.${b64url(payload)}`, "ascii"), { key: privateKey, dsaEncoding: "ieee-p1363" });
  card.signatures = [{ protected: ph, signature: b64url(sig) }];

  const fetchImpl = async (url: string) => {
    if (url.endsWith("/.well-known/agent-card.json")) return new Response(JSON.stringify(card), { status: 200 });
    if (url === "https://example.com/jwks.json") return new Response(JSON.stringify({ keys: [jwk] }), { status: 200 });
    return new Response("", { status: 404 });
  };
  return fetchImpl;
}

test("A2A: verify+map promotes agent to a2a_agent/key_verified and surfaces via Verify API", async () => {
  const [owner] = await db.insert(owners).values({ clerkUserId: `a2a_${Math.round(performance.now())}`, email: "a2a@test.dev" }).returning();
  ownerIds.push(owner.id);
  const slug = `a2a-${owner.id.slice(0, 8)}`;
  const [agent] = await db.insert(agents).values({ ownerId: owner.id, name: "A2A", slug, domain: "example.com", status: "unverified" }).returning();

  const result = await verifyA2AForAgent(agent.id, signedCardFetch());
  assert.equal(result?.valid, true);

  const updated = await db.query.agents.findFirst({ where: eq(agents.id, agent.id) });
  assert.equal(updated?.type, "a2a_agent");
  assert.equal(updated?.status, "key_verified");
  assert.deepEqual(updated?.capabilities, ["search", "summarize"]);

  const verifs = await db.query.verifications.findMany({ where: eq(verifications.agentId, agent.id) });
  assert.ok(verifs.some((v) => v.method === "a2a_card" && v.verifiedAt), "a2a_card verification recorded");
  const sigs = await db.query.trustSignals.findMany({ where: eq(trustSignals.agentId, agent.id) });
  assert.ok(sigs.some((s) => s.signalType === "signed_provenance"));

  // Surfaces through the existing Verify API unchanged.
  const { plaintext } = await createApiKey(owner.id, "t");
  const r = await runVerify({ presentedKey: plaintext, agentQuery: slug });
  assert.equal(r.status, 200);
  assert.equal((r.body.agent as { type: string }).type, "a2a_agent");
  assert.equal(r.body.verified, true);
});

test("A2A: tampered card leaves agent unverified", async () => {
  const [owner] = await db.insert(owners).values({ clerkUserId: `a2a2_${Math.round(performance.now())}`, email: "a2a2@test.dev" }).returning();
  ownerIds.push(owner.id);
  const [agent] = await db.insert(agents).values({ ownerId: owner.id, name: "A2A2", slug: `a2a2-${owner.id.slice(0, 8)}`, domain: "example.com", status: "unverified" }).returning();

  // Mock that serves a card whose signature won't match (empty signatures).
  const badFetch = async (url: string) =>
    url.endsWith("/.well-known/agent-card.json")
      ? new Response(JSON.stringify({ name: "x", version: "1", signatures: [] }), { status: 200 })
      : new Response("", { status: 404 });
  const result = await verifyA2AForAgent(agent.id, badFetch);
  assert.equal(result?.valid, false);
  const updated = await db.query.agents.findFirst({ where: eq(agents.id, agent.id) });
  assert.equal(updated?.status, "unverified");
});
