/**
 * DB integration: uptime sweep + verified-owner reviews. Hits the dev DB.
 *   npm run test:integration:uptime
 */
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { and, eq } from "drizzle-orm";
import { closeDb, db } from "../src/db/index";
import { agents, owners, trustSignals } from "../src/db/schema";
import { runUptimeSweep } from "../src/lib/uptime/service";
import { submitReview, isVerifiedOwner } from "../src/lib/reviews/service";
import { loadTrustScore } from "../src/lib/trust/load";

const ownerIds: string[] = [];
after(async () => {
  for (const id of ownerIds) await db.delete(owners).where(eq(owners.id, id));
  await closeDb();
});

async function mkOwner(email = "u@test.dev") {
  const [o] = await db.insert(owners).values({ clerkUserId: `ur_${Math.round(performance.now())}_${ownerIds.length}`, email }).returning();
  ownerIds.push(o.id);
  return o;
}
async function mkAgent(ownerId: string, status: "key_verified" | "unverified" = "key_verified") {
  const [a] = await db.insert(agents).values({ ownerId, name: "A", slug: `a-${Math.round(performance.now())}-${ownerIds.length}`, domain: "example.com", verifiedDomain: "example.com", status }).returning();
  return a;
}

test("uptime sweep: up→1, then down lowers the rolling value (AC1)", async () => {
  const o = await mkOwner();
  const agent = await mkAgent(o.id);
  const upFetch = async () => new Response("{}", { status: 200 });
  const downFetch = async () => new Response("", { status: 503 });

  await runUptimeSweep({ fetchImpl: upFetch, maxAgents: 1000 });
  let sig = await db.query.trustSignals.findFirst({ where: and(eq(trustSignals.agentId, agent.id), eq(trustSignals.signalType, "uptime")) });
  assert.equal(sig?.value, 1);

  await runUptimeSweep({ fetchImpl: downFetch, maxAgents: 1000 });
  sig = await db.query.trustSignals.findFirst({ where: and(eq(trustSignals.agentId, agent.id), eq(trustSignals.signalType, "uptime")) });
  assert.equal(sig?.value, 0.5, "1 up + 1 down → 0.5");

  // It contributes to the score (weight 0.1 → +5 at value 0.5).
  const { breakdown } = await loadTrustScore(agent.id);
  const up = breakdown.find((b) => b.signalType === "uptime");
  assert.equal(up?.contribution, 0.05);
});

test("reviews: verified-owner only, no self-review, one-per-owner, user_rating recompute (AC3, AC4)", async () => {
  const target = await mkAgent((await mkOwner("target@test.dev")).id); // the agent being reviewed

  // Unverified reviewer → rejected.
  const unverified = await mkOwner("unv@test.dev");
  await mkAgent(unverified.id, "unverified");
  assert.equal(await isVerifiedOwner(unverified.id), false);
  await assert.rejects(() => submitReview(unverified.id, target.id, 5, "x"), /verified owners/);

  // Verified reviewers (each owns a verified agent of their own).
  const r1 = await mkOwner("r1@test.dev");
  await mkAgent(r1.id, "key_verified");
  const r2 = await mkOwner("r2@test.dev");
  await mkAgent(r2.id, "key_verified");

  // Self-review rejected (reviewing your own agent).
  const r1OwnAgent = await mkAgent(r1.id);
  await assert.rejects(() => submitReview(r1.id, r1OwnAgent.id, 5, null), /own agent/);

  await submitReview(r1.id, target.id, 5, "great");
  await submitReview(r2.id, target.id, 3, "ok");
  // Duplicate by r1 updates, not duplicates.
  await submitReview(r1.id, target.id, 4, "updated");

  const sig = await db.query.trustSignals.findFirst({ where: and(eq(trustSignals.agentId, target.id), eq(trustSignals.signalType, "user_rating")) });
  // ratings now 4 and 3 → avg 3.5 → value 0.7
  assert.equal(sig?.value, 0.7);
  const raw = sig?.raw as { count: number };
  assert.equal(raw.count, 2, "one review per owner (r1 updated)");
});
