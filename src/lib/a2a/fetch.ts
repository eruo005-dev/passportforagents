import "server-only";
import { normalizeHost } from "../passport/core";
import { safeFetch } from "../verification/safe-fetch";
import {
  verifyA2ACard,
  type A2AAgentCard,
  type A2AVerifyResult,
  type JwkResolver,
} from "./card";
import type { Jwk } from "../crypto/jws";

const CARD_PATHS = ["/.well-known/agent-card.json", "/.well-known/agent.json"];

export type A2AFetchResult = A2AVerifyResult & {
  fetched: boolean;
  url: string | null;
  card: A2AAgentCard | null;
};

/**
 * Fetch an A2A Agent Card from a domain and verify it end-to-end. The signing
 * key is resolved from each signature's `jku` (JWKS over HTTPS) — fetched
 * through the SSRF-hardened `safeFetch`. `fetchImpl` injectable for tests.
 */
export async function fetchAndVerifyA2ACard(
  domain: string,
  fetchImpl: (input: string, init?: RequestInit) => Promise<Response> = safeFetch,
): Promise<A2AFetchResult> {
  const host = normalizeHost(domain);
  const base = {
    fetched: false,
    url: null as string | null,
    card: null as A2AAgentCard | null,
    checks: { has_signature: false, key_resolved: false, signature_valid: false, domain_binding: false },
    keyHost: null as string | null,
  };

  let card: A2AAgentCard | null = null;
  let url: string | null = null;
  for (const path of CARD_PATHS) {
    const candidate = `https://${host}${path}`;
    try {
      const res = await fetchImpl(candidate);
      if (res.ok) {
        card = (await res.json()) as A2AAgentCard;
        url = candidate;
        break;
      }
    } catch {
      // try next path
    }
  }
  if (!card) {
    return { ...base, valid: false, error: `no A2A agent card found on ${host}` };
  }

  // Resolve a signature's key from its `jku` JWKS (HTTPS, SSRF-safe).
  const resolveJwk: JwkResolver = async (header) => {
    if (!header.jku) return null;
    try {
      const jr = await fetchImpl(header.jku);
      if (!jr.ok) return null;
      const jwks = (await jr.json()) as { keys?: Jwk[] };
      const keys = jwks.keys ?? [];
      return keys.find((k) => k.kid === header.kid) ?? keys[0] ?? null;
    } catch {
      return null;
    }
  };

  const result = await verifyA2ACard(card, host, resolveJwk);
  return { ...result, fetched: true, url, card };
}
