import "server-only";
import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { agents, registryIngest, trustSignals } from "@/db/schema";
import { TRUST_WEIGHTS } from "@/lib/trust/weights";
import { fetchRegistryPage, type NormalizedEntry } from "./mcp";

const SOURCE = "mcp_registry" as const;
const CURSOR_ID = "__cursor__"; // sentinel row holding the incremental watermark

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

// raw jsonb accessors
const rawStatus = sql`${registryIngest.raw}->>'status'`;
const rawIsLatest = sql`${registryIngest.raw}->>'isLatest'`;
const rawName = sql`${registryIngest.raw}->>'name'`;
const rawDesc = sql`${registryIngest.raw}->>'description'`;
const rawUpdatedAt = sql`${registryIngest.raw}->>'updatedAt'`;
const rawRepo = sql`${registryIngest.raw}->>'repoUrl'`;

/** Run an incremental ingest of the MCP registry into registry_ingest. */
export async function runRegistryIngest(opts: {
  fetchImpl?: Fetcher;
  maxPages?: number;
} = {}) {
  const maxPages = opts.maxPages ?? 50;

  const sentinel = await db.query.registryIngest.findFirst({
    where: and(eq(registryIngest.source, SOURCE), eq(registryIngest.externalId, CURSOR_ID)),
  });
  const updatedSince = (sentinel?.raw as { updatedSince?: string } | null)?.updatedSince ?? null;

  let cursor: string | null = null;
  let ingested = 0;
  let deleted = 0;
  let skipped = 0;
  let pages = 0;
  let maxUpdatedAt = updatedSince;

  do {
    const page = await fetchRegistryPage({ cursor, updatedSince, fetchImpl: opts.fetchImpl });
    pages++;
    skipped += page.rawCount - page.entries.length;

    for (const entry of page.entries) {
      if (entry.status === "deleted") {
        await db
          .delete(registryIngest)
          .where(and(eq(registryIngest.source, SOURCE), eq(registryIngest.externalId, entry.name)));
        deleted++;
      } else {
        await db
          .insert(registryIngest)
          .values({ source: SOURCE, externalId: entry.name, raw: entry as object })
          .onConflictDoUpdate({
            target: [registryIngest.source, registryIngest.externalId],
            set: { raw: entry as object, ingestedAt: new Date() },
          });
        ingested++;
      }
      if (entry.updatedAt && (!maxUpdatedAt || entry.updatedAt > maxUpdatedAt)) {
        maxUpdatedAt = entry.updatedAt;
      }
    }
    cursor = page.nextCursor;
  } while (cursor && pages < maxPages);

  // Persist the watermark for the next incremental run.
  if (maxUpdatedAt) {
    await db
      .insert(registryIngest)
      .values({ source: SOURCE, externalId: CURSOR_ID, raw: { updatedSince: maxUpdatedAt } as object })
      .onConflictDoUpdate({
        target: [registryIngest.source, registryIngest.externalId],
        set: { raw: { updatedSince: maxUpdatedAt } as object, ingestedAt: new Date() },
      });
  }

  return { ingested, deleted, skipped, pages };
}

export type DirectoryRow = NormalizedEntry & {
  claimed: boolean;
  claimedSlug: string | null;
  claimedStatus: string | null;
};

/** Search the mirrored directory (active, latest entries only). */
export async function searchRegistry(query: string, limit = 50): Promise<DirectoryRow[]> {
  const conds = [
    eq(registryIngest.source, SOURCE),
    ne(registryIngest.externalId, CURSOR_ID),
    sql`${rawStatus} = 'active'`,
    sql`${rawIsLatest} = 'true'`,
  ];
  const q = query.trim();
  if (q) {
    const like = `%${q}%`;
    conds.push(sql`(${rawName} ILIKE ${like} OR ${rawDesc} ILIKE ${like})`);
  }

  const rows = await db
    .select({ raw: registryIngest.raw })
    .from(registryIngest)
    .where(and(...conds))
    .orderBy(sql`${rawUpdatedAt} DESC NULLS LAST`)
    .limit(limit);

  const entries = rows.map((r) => r.raw as NormalizedEntry);

  // Enrich with claimed/verified status by matching repo URL.
  const repos = entries.map((e) => e.repoUrl).filter((x): x is string => !!x);
  const claimedByRepo = new Map<string, { slug: string; status: string }>();
  if (repos.length > 0) {
    const claimed = await db
      .select({ repoUrl: agents.repoUrl, slug: agents.slug, status: agents.status })
      .from(agents)
      .where(inArray(agents.repoUrl, repos));
    for (const c of claimed) {
      if (c.repoUrl) claimedByRepo.set(c.repoUrl, { slug: c.slug, status: c.status });
    }
  }

  return entries.map((e) => {
    const match = e.repoUrl ? claimedByRepo.get(e.repoUrl) : undefined;
    return {
      ...e,
      claimed: !!match,
      claimedSlug: match?.slug ?? null,
      claimedStatus: match?.status ?? null,
    };
  });
}

/** A single registry entry by its name (external_id). */
export async function getRegistryEntry(name: string): Promise<NormalizedEntry | null> {
  const row = await db.query.registryIngest.findFirst({
    where: and(eq(registryIngest.source, SOURCE), eq(registryIngest.externalId, name)),
  });
  if (!row || row.externalId === CURSOR_ID) return null;
  return row.raw as NormalizedEntry;
}

/** Active, latest, described entries for the sitemap (name + lastmod). */
export async function listRegistryForSitemap(limit = 5000): Promise<{ name: string; updatedAt: string | null }[]> {
  const rows = await db
    .select({ name: rawName, updatedAt: rawUpdatedAt })
    .from(registryIngest)
    .where(
      and(
        eq(registryIngest.source, SOURCE),
        ne(registryIngest.externalId, CURSOR_ID),
        sql`${rawStatus} = 'active'`,
        sql`${rawIsLatest} = 'true'`,
        sql`${rawDesc} IS NOT NULL`,
      ),
    )
    .limit(limit);
  return rows.map((r) => ({ name: r.name as string, updatedAt: (r.updatedAt as string) ?? null }));
}

/**
 * If a claimed agent's repo matches a registry entry, (re)write its
 * `registry_presence` trust signal. Idempotent.
 */
export async function refreshRegistryPresence(agentId: string): Promise<boolean> {
  const agent = await db.query.agents.findFirst({ where: eq(agents.id, agentId) });
  if (!agent?.repoUrl) return false;

  const match = await db
    .select({ id: registryIngest.id })
    .from(registryIngest)
    .where(and(eq(registryIngest.source, SOURCE), sql`${rawRepo} = ${agent.repoUrl}`))
    .limit(1);
  if (match.length === 0) return false;

  await db
    .delete(trustSignals)
    .where(and(eq(trustSignals.agentId, agentId), eq(trustSignals.signalType, "registry_presence")));
  await db.insert(trustSignals).values({
    agentId,
    signalType: "registry_presence",
    value: 1,
    weight: TRUST_WEIGHTS.registry_presence,
    raw: { source: SOURCE, repoUrl: agent.repoUrl },
  });
  return true;
}
