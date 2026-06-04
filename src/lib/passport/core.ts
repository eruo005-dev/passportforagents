/**
 * Core Agent Passport sign/verify logic.
 *
 * Pure and environment-agnostic: depends only on the crypto helpers and the
 * Web `fetch`/`URL` globals (present in Node 18+, edge runtimes, and browsers).
 * The hosted product AND the standalone reference verifier both import this —
 * one source of truth, zero dependence on any AgentPassport server.
 */
import { sign as edSign, verify as edVerify } from "../crypto/ed25519";
import { jcsCanonicalizeBytes } from "../crypto/jcs";
import {
  decodePublicKey,
  decodeSignature,
  encodePublicKey,
  encodeSignature,
} from "../crypto/multibase";
import {
  type AgentPassport,
  type AgentPassportBody,
  SIGNATURE_FIELD,
} from "./types";

/** Strip the signature field to obtain the exact bytes that get signed. */
export function passportSigningBytes(
  doc: AgentPassportBody | AgentPassport,
): Uint8Array {
  const body: Record<string, unknown> = { ...doc };
  delete body[SIGNATURE_FIELD];
  return jcsCanonicalizeBytes(body);
}

/** Sign a passport body, returning the full document with `signature` attached. */
export function signPassport(
  body: AgentPassportBody,
  secretKey: Uint8Array,
): AgentPassport {
  const message = passportSigningBytes(body);
  const sig = edSign(message, secretKey);
  return { ...body, signature: encodeSignature(sig) };
}

export type VerifyResult = {
  valid: boolean;
  /** Each independent check and whether it passed — transparency is the product. */
  checks: {
    signature_valid: boolean;
    domain_matches: boolean;
    public_key_wellformed: boolean;
  };
  /** Raw public key bytes if it parsed, else null. */
  publicKey: Uint8Array | null;
  /** First failure reason, if any. */
  error?: string;
};

/**
 * Verify a passport document's cryptographic integrity, and (optionally) that
 * the domain serving it matches `owner_domain`.
 *
 * @param doc           parsed agent-passport.json
 * @param servedFromHost host the file was actually fetched from (e.g. "example.com").
 *                       Pass null to skip the domain-match check (signature-only).
 */
export function verifyPassport(
  doc: AgentPassport,
  servedFromHost: string | null,
): VerifyResult {
  const checks = {
    signature_valid: false,
    domain_matches: false,
    public_key_wellformed: false,
  };

  let publicKey: Uint8Array | null = null;
  try {
    publicKey = decodePublicKey(doc.public_key);
    checks.public_key_wellformed = true;
  } catch (e) {
    return {
      valid: false,
      checks,
      publicKey: null,
      error: `public_key: ${(e as Error).message}`,
    };
  }

  // Signature check over the JCS-canonicalized body.
  try {
    const message = passportSigningBytes(doc);
    const sig = decodeSignature(doc.signature);
    checks.signature_valid = edVerify(sig, message, publicKey);
  } catch (e) {
    return {
      valid: false,
      checks,
      publicKey,
      error: `signature: ${(e as Error).message}`,
    };
  }

  // Domain control: the host serving the file must match the claimed owner_domain.
  if (servedFromHost === null) {
    checks.domain_matches = true; // skipped by caller
  } else {
    checks.domain_matches =
      normalizeHost(servedFromHost) === normalizeHost(doc.owner_domain);
  }

  const valid =
    checks.signature_valid &&
    checks.domain_matches &&
    checks.public_key_wellformed;

  return {
    valid,
    checks,
    publicKey,
    error: valid
      ? undefined
      : !checks.signature_valid
        ? "signature did not verify against public_key"
        : !checks.domain_matches
          ? `domain mismatch: served from "${servedFromHost}" but owner_domain is "${doc.owner_domain}"`
          : undefined,
  };
}

/** Lower-case, strip a leading "www." and any port, for host comparison. */
export function normalizeHost(host: string): string {
  return host
    .trim()
    .toLowerCase()
    .replace(/^www\./, "")
    .replace(/:\d+$/, "");
}

/** Build the canonical well-known URL for a domain. */
export function wellKnownUrl(domain: string): string {
  const host = normalizeHost(domain);
  return `https://${host}/.well-known/agent-passport.json`;
}

export type FetchAndVerifyResult = VerifyResult & {
  url: string;
  fetched: boolean;
  document: AgentPassport | null;
};

/**
 * Fetch a domain's agent-passport.json over HTTPS and verify it end-to-end,
 * including that the serving host matches owner_domain.
 */
export async function fetchAndVerify(
  domain: string,
  fetchImpl: typeof fetch = fetch,
): Promise<FetchAndVerifyResult> {
  const url = wellKnownUrl(domain);
  const base = {
    url,
    fetched: false,
    document: null as AgentPassport | null,
    checks: {
      signature_valid: false,
      domain_matches: false,
      public_key_wellformed: false,
    },
    publicKey: null as Uint8Array | null,
  };

  let res: Response;
  try {
    res = await fetchImpl(url, {
      redirect: "error", // a redirect off-domain would break the domain-control guarantee
      headers: { accept: "application/json" },
    });
  } catch (e) {
    return { ...base, valid: false, error: `fetch failed: ${(e as Error).message}` };
  }

  if (!res.ok) {
    return { ...base, valid: false, error: `HTTP ${res.status} fetching ${url}` };
  }

  let doc: AgentPassport;
  try {
    doc = (await res.json()) as AgentPassport;
  } catch (e) {
    return {
      ...base,
      fetched: true,
      valid: false,
      error: `invalid JSON: ${(e as Error).message}`,
    };
  }

  const host = new URL(url).host;
  const result = verifyPassport(doc, host);
  return { ...result, url, fetched: true, document: doc };
}

// Re-export key encoders so the standalone verifier needs only this module.
export { encodePublicKey, encodeSignature };
