/**
 * Slugs for public agent profile URLs (/agent/[slug]).
 * Derived from the agent name + domain so they're readable and stable.
 */

/** Turn an arbitrary string into a URL-safe slug fragment. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** Base slug from name + domain, e.g. "Example MCP" + "example.com" → "example-mcp-example-com". */
export function baseSlug(name: string, domain: string): string {
  const host = domain.replace(/^https?:\/\//, "").replace(/^www\./, "");
  const combined = `${slugify(name)}-${slugify(host)}`.replace(/^-+|-+$/g, "");
  return combined || slugify(host) || "agent";
}

/**
 * Resolve a unique slug given a base and an existence check.
 * Tries base, then base-2, base-3, … until `exists` returns false.
 */
export async function uniqueSlug(
  base: string,
  exists: (candidate: string) => Promise<boolean>,
): Promise<string> {
  if (!(await exists(base))) return base;
  for (let i = 2; i < 10000; i++) {
    const candidate = `${base}-${i}`;
    if (!(await exists(candidate))) return candidate;
  }
  throw new Error("Could not allocate a unique slug");
}
