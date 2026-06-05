/**
 * DB integration: per-agent IDs (agt_) — resolution + verify-once→N-inherit.
 *   npm run test:integration:subagents
 */
process.env.STRIPE_SECRET_KEY ||= "sk_test_dummy";

import { test, after } from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { closeDb, db } from "../src/db/index";
import { agents, owners } from "../src/db/schema";
import { createApiKey } from "../src/lib/api-keys/service";
import { createSubAgentForOwner, upsertVerifiedDomain } from "../src/lib/domains";
import { runVerify } from "../src/lib/api/verify";
import { isAgentPublicId } from "../src/lib/ids";
import { loadTrustScore } from "../src/lib/trust/load";

const ownerIds: string[] = [];
after(async () => {
  for (const id of ownerIds) await db.delete(owners).where(eq(owners.id, id));
  await closeDb();
});
async function mkOwner() {
  const [o] = await db.insert(owners).values({ clerkUserId: `sub_${Math.round(performance.now())}_${ownerIds.length}`, email: "s@test.dev" }).returning();
  ownerIds.push(o.id);
  return o;
}

test("agt_ resolution: Verify API resolves by id == slug == domain (AC-B)", async () => {
  const owner = await mkOwner();
  const [agent] = await db.insert(agents).values({ ownerId: owner.id, name: "R", slug: `r-${owner.id.slice(0, 8)}`, domain: "example.com", verifiedDomain: "example.com", status: "key_verified" }).returning();
  assert.ok(isAgentPublicId(agent.publicId), "agent got an agt_ id");
  const { plaintext } = await createApiKey(owner.id, "k");

  const byId = await runVerify({ presentedKey: plaintext, agentQuery: agent.publicId });
  const bySlug = await runVerify({ presentedKey: plaintext, agentQuery: agent.slug });
  const byDomain = await runVerify({ presentedKey: plaintext, agentQuery: "example.com" });
  for (const r of [byId, bySlug, byDomain]) assert.equal(r.status, 200);
  assert.equal((byId.body.agent as { slug: string }).slug, agent.slug);
  assert.equal((bySlug.body.agent as { slug: string }).slug, agent.slug);
  assert.equal((byDomain.body.agent as { slug: string }).slug, agent.slug);
  assert.equal((byId.body.agent as { id: string }).id, agent.publicId, "public_id in body");
});

test("verify once → N sub-agents inherit (AC-C): AgoraMind personas", async () => {
  const owner = await mkOwner();
  // Verify the domain ONCE.
  const domainId = await upsertVerifiedDomain(owner.id, "agoramind.ai", "key_verified", { demo: true });

  // Register two personas under it — no re-verification.
  const a = await createSubAgentForOwner(owner.id, { domainId, name: "The Ethicist", capabilities: ["debate"] });
  const b = await createSubAgentForOwner(owner.id, { domainId, name: "The Provocateur", capabilities: ["debate"] });

  assert.notEqual(a.publicId, b.publicId, "distinct agt_ ids");
  assert.ok(isAgentPublicId(a.publicId) && isAgentPublicId(b.publicId));
  assert.equal(a.status, "key_verified", "inherits the verified domain status");
  assert.equal(b.status, "key_verified");
  assert.equal(a.domainId, domainId);
  assert.equal(a.verifiedDomain, "agoramind.ai");
  // Inherits the domain's identity signals → real trust score (not 0).
  assert.equal((await loadTrustScore(a.id)).score, 50, "domain_control 30 + signed_provenance 20");

  // Both resolve via the Verify API by their own id.
  const { plaintext } = await createApiKey(owner.id, "k");
  const ra = await runVerify({ presentedKey: plaintext, agentQuery: a.publicId });
  assert.equal(ra.status, 200);
  assert.equal((ra.body.agent as { name: string }).name, "The Ethicist");
  assert.equal(ra.body.verified, true);
});

test("sub-agent registration is owner-scoped (can't register under another owner's domain)", async () => {
  const o1 = await mkOwner();
  const o2 = await mkOwner();
  const domainId = await upsertVerifiedDomain(o1.id, "o1.example", "domain_verified");
  await assert.rejects(
    () => createSubAgentForOwner(o2.id, { domainId, name: "x" }),
    /Verified domain not found/,
  );
});
