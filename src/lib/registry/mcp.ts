/**
 * Client for the official MCP Registry (registry.modelcontextprotocol.io).
 *
 * Verified live (RESEARCH pass: see PROGRESS): unauthenticated REST, cursor
 * pagination, `?version=latest`, `?updated_since=<RFC3339>` incremental, entries
 * shaped `{ server, _meta }`. The registry is preview-stage with schema drift,
 * so parsing is deliberately TOLERANT: never hard-fail a row; skip only rows
 * missing the required `name`. We keep the verbatim element under `original` for
 * drift resilience and project a normalized shape for querying.
 *
 * Pure + fetch-injectable (no DB) so it is unit/integration testable offline.
 */

export const MCP_REGISTRY_BASE = "https://registry.modelcontextprotocol.io";
const OFFICIAL_META = "io.modelcontextprotocol.registry/official";

export type NormalizedEntry = {
  name: string;
  description: string | null;
  repoUrl: string | null;
  websiteUrl: string | null;
  version: string | null;
  status: string; // active | deprecated | deleted | unknown
  isLatest: boolean;
  updatedAt: string | null; // RFC3339
  original: unknown; // verbatim list element, for drift resilience
};

function str(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

const rec = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" ? (v as Record<string, unknown>) : {};

/** Tolerant parse of one `{server,_meta}` element. Returns null if no name. */
export function parseEntry(el: unknown): NormalizedEntry | null {
  if (!el || typeof el !== "object") return null;
  const e = rec(el);
  const server = rec(e.server);
  const name = str(server.name);
  if (!name) return null; // required identity field — skip silently (counted by caller)

  const repository = rec(server.repository);
  const official = rec(rec(e._meta)[OFFICIAL_META]);
  return {
    name,
    description: str(server.description),
    repoUrl: str(repository.url),
    websiteUrl: str(server.websiteUrl),
    version: str(server.version),
    status: str(official.status) ?? "active",
    isLatest: official.isLatest !== false, // default true when absent
    updatedAt: str(official.updatedAt) ?? str(official.publishedAt),
    original: el,
  };
}

export type RegistryPage = {
  entries: NormalizedEntry[];
  nextCursor: string | null;
  rawCount: number; // servers in the page before name-filtering (for skip count)
};

/** Fetch one page of servers. `fetchImpl` injectable for tests. */
export async function fetchRegistryPage(opts: {
  cursor?: string | null;
  updatedSince?: string | null;
  limit?: number;
  baseUrl?: string;
  fetchImpl?: (input: string, init?: RequestInit) => Promise<Response>;
}): Promise<RegistryPage> {
  const url = new URL("/v0/servers", opts.baseUrl ?? MCP_REGISTRY_BASE);
  url.searchParams.set("limit", String(opts.limit ?? 100));
  url.searchParams.set("version", "latest");
  if (opts.cursor) url.searchParams.set("cursor", opts.cursor);
  if (opts.updatedSince) url.searchParams.set("updated_since", opts.updatedSince);

  const fetchImpl = opts.fetchImpl ?? fetch;
  const res = await fetchImpl(url.toString(), {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`MCP registry HTTP ${res.status}`);
  const body = (await res.json()) as { servers?: unknown[]; metadata?: { nextCursor?: string } };
  const servers = Array.isArray(body.servers) ? body.servers : [];
  const entries = servers.map(parseEntry).filter((x): x is NormalizedEntry => x !== null);
  return {
    entries,
    nextCursor: body.metadata?.nextCursor || null,
    rawCount: servers.length,
  };
}
