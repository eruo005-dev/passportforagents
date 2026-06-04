/**
 * A2A (Agent2Agent) signed Agent Card verification — spec v1.0.0 (§8.4).
 *
 * Verification:
 *  1. payload = JCS(RFC 8785) of the card with `signatures` excluded.
 *  2. For each entry in `signatures[]`, verify the detached JWS over that payload.
 *  3. A card is signature-valid if >= 1 signature verifies (multi-sig = rotation).
 *  4. Identity binding (OUR policy — the spec leans on TLS): the key's `jku` host
 *     (or the card's provider.url host) must match the host serving the card.
 *
 * The spec does NOT mandate EdDSA or bind key->org; those choices are documented
 * in RESEARCH pass 002. Key resolution is injectable so this stays pure/testable.
 */
import { jcsCanonicalizeBytes } from "../crypto/jcs";
import { decodeProtectedHeader, verifyJwsDetached, type Jwk } from "../crypto/jws";
import { normalizeHost } from "../passport/core";

export type A2ASignature = {
  protected: string;
  signature: string;
  header?: Record<string, unknown>;
};

export type A2AAgentCard = {
  name?: string;
  description?: string;
  version?: string;
  provider?: { url?: string; organization?: string };
  skills?: { id: string; name: string }[];
  capabilities?: Record<string, unknown>;
  supportedInterfaces?: { url: string }[];
  signatures?: A2ASignature[];
  [k: string]: unknown;
};

/** Resolve the public JWK for a signature's protected header (e.g. fetch `jku`). */
export type JwkResolver = (header: {
  alg: string;
  kid?: string;
  jku?: string;
}) => Promise<Jwk | null>;

export type A2AVerifyResult = {
  valid: boolean;
  checks: {
    has_signature: boolean;
    key_resolved: boolean;
    signature_valid: boolean;
    domain_binding: boolean;
  };
  /** host the verifying key was anchored to (jku host), if any. */
  keyHost: string | null;
  error?: string;
};

/** Bytes that were signed: the card minus its `signatures` field, JCS-canonicalized. */
export function a2aSigningPayload(card: A2AAgentCard): Uint8Array {
  const body: Record<string, unknown> = { ...card };
  delete body.signatures;
  return jcsCanonicalizeBytes(body);
}

function hostOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return normalizeHost(new URL(url).host);
  } catch {
    return null;
  }
}

/**
 * Verify an A2A Agent Card. `servedFromHost` is the host the card was fetched
 * from (null to skip the domain-binding check / signature-only mode).
 */
export async function verifyA2ACard(
  card: A2AAgentCard,
  servedFromHost: string | null,
  resolveJwk: JwkResolver,
): Promise<A2AVerifyResult> {
  const checks = {
    has_signature: false,
    key_resolved: false,
    signature_valid: false,
    domain_binding: false,
  };

  const sigs = card.signatures ?? [];
  if (sigs.length === 0) {
    return { valid: false, checks, keyHost: null, error: "card is not signed" };
  }
  checks.has_signature = true;

  const payload = a2aSigningPayload(card);
  let keyHost: string | null = null;

  for (const sig of sigs) {
    let header;
    try {
      header = decodeProtectedHeader(sig.protected);
    } catch {
      continue;
    }
    const jwk = await resolveJwk(header);
    if (!jwk) continue;
    checks.key_resolved = true;

    const ok = verifyJwsDetached({
      protectedB64: sig.protected,
      payloadBytes: payload,
      signatureB64: sig.signature,
      jwk,
    });
    if (ok) {
      checks.signature_valid = true;
      keyHost = hostOf(header.jku) ?? hostOf(card.provider?.url);
      break;
    }
  }

  if (!checks.signature_valid) {
    return {
      valid: false,
      checks,
      keyHost,
      error: checks.key_resolved
        ? "no signature verified against its key"
        : "could not resolve a signing key",
    };
  }

  // Identity binding policy (ours): the verifying key's host must match the
  // host that served the card. Skipped when servedFromHost is null.
  if (servedFromHost === null) {
    checks.domain_binding = true;
  } else {
    const served = normalizeHost(servedFromHost);
    const provHost = hostOf(card.provider?.url);
    checks.domain_binding = keyHost === served || provHost === served;
  }

  const valid = checks.signature_valid && checks.domain_binding;
  return {
    valid,
    checks,
    keyHost,
    error: valid
      ? undefined
      : `key/provider host does not match serving host "${servedFromHost}"`,
  };
}
