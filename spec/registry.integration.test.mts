/**
 * DB integration test for MCP Registry ingest + directory + presence. Hits dev DB.
 *   npm run test:integration:registry
 * Cleans up its own rows (registry_ingest by name prefix + temp owners).
 */
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { and, eq, like } from "drizzle-orm";
import { closeDb, db } from "../src/db/index";
import { agents, owners, registryIngest, trustSignals } from "../src/db/schema";
import {
  runRegistryIngest,
  searchRegistry,
  refreshRegistryPresence,
} from "../src/lib/registry/ingest";

const PFX = "itest.pfa/"; // unique name prefix for this test's rows
const ownerIds: string[] = [];

after(async () => {
  await db.delete(registryIngest).where(like(registryIngest.externalId, `${PFX}%`));
  await db
    .delete(registryIngest)
    .where(and(eq(registryIngest.source, "mcp_registry"), eq(registryIngest.externalId, "__cursor__")));
  for (const id of ownerIds) await db.delete(owners).where(eq(owners.id, id));
  await closeDb();
});

function el(n: number, over: Record<string, unknown> = {}, meta: Record<string, unknown> = {}) {
  return {
    server: { name: `${PFX}srv-${n}`, description: `server ${n}`, repository: { url: `https://github.com/itest/srv-${n}` }, version: "1.0.0", ...over },
    _meta: { "io.modelcontextprotocol.registry/official": { status: "active", isLatest: true, updatedAt: `2026-05-0${(n % 9) + 1}T00:00:00Z`, ...meta } },
  };
}

// Serve `pages` arrays of elements, keyed by cursor.
function pagedFetch(pages: unknown[][]) {
  const seen: string[] = [];
  const fetchImpl = async (url: string) => {
    seen.push(url);
    const u = new URL(url);
    const cursor = u.searchParams.get("cursor");
    const idx = cursor ? Number(cursor) : 0;
    const servers = pages[idx] ?? [];
    const nextCursor = idx + 1 < pages.length ? String(idx + 1) : undefined;
    return new Response(JSON.stringify({ servers, metadata: { nextCursor } }), { status: 200 });
  };
  return { fetchImpl, seen };
}

test("ingest: paginates all pages + idempotent re-run (AC1, AC3)", async () => {
  const pages = [
    [el(1), el(2), { server: {} }], // one nameless → skipped
    [el(3), el(4)],
    [el(5)],
  ];
  const { fetchImpl } = pagedFetch(pages);
  const r1 = await runRegistryIngest({ fetchImpl });
  assert.equal(r1.pages, 3);
  assert.equal(r1.ingested, 5);
  assert.equal(r1.skipped, 1);

  const countAfter1 = (await db.select().from(registryIngest).where(like(registryIngest.externalId, `${PFX}%`))).length;
  assert.equal(countAfter1, 5);

  // Idempotent: same fixture again → still 5 rows, no dup-key error.
  await runRegistryIngest({ fetchImpl: pagedFetch(pages).fetchImpl });
  const countAfter2 = (await db.select().from(registryIngest).where(like(registryIngest.externalId, `${PFX}%`))).length;
  assert.equal(countAfter2, 5);
});

test("ingest: incremental watermark passed as updated_since (AC2)", async () => {
  const { fetchImpl, seen } = pagedFetch([[el(6)]]);
  await runRegistryIngest({ fetchImpl });
  // The watermark is the max updatedAt; a follow-up run must send updated_since.
  const { fetchImpl: f2, seen: seen2 } = pagedFetch([[]]);
  await runRegistryIngest({ fetchImpl: f2 });
  assert.ok(seen2.some((u) => u.includes("updated_since=")), "second run sends updated_since");
  void seen;
});

test("ingest: deleted removed, deprecated flagged, non-latest excluded from directory (AC5)", async () => {
  // seed active
  await runRegistryIngest({ fetchImpl: pagedFetch([[el(10), el(11), el(12)]]).fetchImpl });
  // now: 10 deleted, 11 deprecated, 12 not latest
  await runRegistryIngest({
    fetchImpl: pagedFetch([[
      el(10, {}, { status: "deleted" }),
      el(11, {}, { status: "deprecated" }),
      el(12, {}, { isLatest: false }),
    ]]).fetchImpl,
  });
  const rows = await searchRegistry(PFX, 100);
  const names = rows.map((r) => r.name);
  assert.ok(!names.includes(`${PFX}srv-10`), "deleted removed from directory");
  assert.ok(!names.includes(`${PFX}srv-11`), "deprecated excluded (status!=active)");
  assert.ok(!names.includes(`${PFX}srv-12`), "non-latest excluded");
});

test("directory search + claimed enrichment + registry_presence (AC6, AC7)", async () => {
  await runRegistryIngest({ fetchImpl: pagedFetch([[el(20)]]).fetchImpl });

  const [owner] = await db.insert(owners).values({ clerkUserId: `reg_${Math.round(performance.now())}`, email: "r@test.dev" }).returning();
  ownerIds.push(owner.id);
  const [agent] = await db
    .insert(agents)
    .values({ ownerId: owner.id, name: "Srv20", slug: `srv20-${owner.id.slice(0, 8)}`, domain: "itest20.dev", repoUrl: "https://github.com/itest/srv-20", status: "key_verified" })
    .returning();

  // search finds it and marks claimed/verified
  const rows = await searchRegistry(`${PFX}srv-20`, 10);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].claimed, true);
  assert.equal(rows[0].claimedStatus, "key_verified");

  // registry_presence written once, idempotent
  assert.equal(await refreshRegistryPresence(agent.id), true);
  assert.equal(await refreshRegistryPresence(agent.id), true);
  const sigs = await db
    .select()
    .from(trustSignals)
    .where(and(eq(trustSignals.agentId, agent.id), eq(trustSignals.signalType, "registry_presence")));
  assert.equal(sigs.length, 1, "exactly one registry_presence signal (idempotent)");
});
