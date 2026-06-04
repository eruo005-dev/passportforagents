import { resolveTxt } from "node:dns/promises";

/**
 * DNS TXT domain-control proof.
 *
 * The owner adds a TXT record `agent-passport-challenge=<token>` to their
 * domain. We resolve TXT records and look for an exact token match. This proves
 * domain control (→ `domain_verified`) but is NOT a cryptographic key proof —
 * only the `.well-known` signature path reaches `key_verified` (SPEC §5).
 *
 * The matcher is pure (unit-testable); the resolver is the only impure part.
 */

const PREFIX = "agent-passport-challenge=";

/** The exact TXT value the owner must publish. */
export function expectedTxtRecord(token: string): string {
  return `${PREFIX}${token}`;
}

/** Pure: does any record carry our challenge token? */
export function matchesChallenge(records: string[], token: string): boolean {
  const want = expectedTxtRecord(token).trim();
  return records.some((r) => r.trim() === want);
}

export type DnsCheckResult = {
  matched: boolean;
  records: string[];
  error?: string;
};

/** Resolve TXT records for a domain and check for the challenge token. */
export async function checkDnsChallenge(
  domain: string,
  token: string,
  resolver: (d: string) => Promise<string[][]> = resolveTxt,
): Promise<DnsCheckResult> {
  const host = domain
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/:\d+$/, "");
  try {
    const chunks = await resolver(host);
    // resolveTxt returns string[][] — each record is an array of strings to join.
    const records = chunks.map((parts) => parts.join(""));
    return { matched: matchesChallenge(records, token), records };
  } catch (e) {
    return { matched: false, records: [], error: (e as Error).message };
  }
}
