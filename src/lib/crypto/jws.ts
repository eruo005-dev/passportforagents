/**
 * Minimal JWS (RFC 7515) detached-payload verification for A2A Agent Cards.
 *
 * A2A signs the JCS-canonicalized card (with `signatures` excluded) as a
 * detached JWS payload. We verify with Node's stdlib `crypto` (JWK import) —
 * supporting ES256, RS256, and EdDSA — so NO JOSE dependency is needed.
 *
 * Algorithms are an allowlist we choose (the A2A spec exemplifies ES256/RS256
 * and does not close the set). EdDSA is included for the Ed25519-leaning
 * ecosystem direction.
 */
import { createPublicKey, verify as nodeVerify, type JsonWebKeyInput } from "node:crypto";

export type Jwk = JsonWebKey & { kid?: string };

export type JwsProtectedHeader = {
  alg: string;
  kid?: string;
  jku?: string;
  typ?: string;
};

const ALLOWED_ALGS = new Set(["ES256", "RS256", "EdDSA"]);

function b64urlToBytes(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
  return new Uint8Array(Buffer.from(b64, "base64"));
}

function bytesToB64url(b: Uint8Array): string {
  return Buffer.from(b).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Decode a JWS protected header from its base64url-encoded JSON. */
export function decodeProtectedHeader(protectedB64: string): JwsProtectedHeader {
  const json = Buffer.from(b64urlToBytes(protectedB64)).toString("utf8");
  return JSON.parse(json) as JwsProtectedHeader;
}

/**
 * Verify one detached JWS signature over `payloadBytes` using `jwk`.
 * signing input = ASCII(protectedB64 + "." + BASE64URL(payload)).
 */
export function verifyJwsDetached(opts: {
  protectedB64: string;
  payloadBytes: Uint8Array;
  signatureB64: string;
  jwk: Jwk;
}): boolean {
  let header: JwsProtectedHeader;
  try {
    header = decodeProtectedHeader(opts.protectedB64);
  } catch {
    return false;
  }
  if (!header.alg || !ALLOWED_ALGS.has(header.alg)) return false;

  const signingInput = Buffer.from(
    `${opts.protectedB64}.${bytesToB64url(opts.payloadBytes)}`,
    "ascii",
  );
  const signature = b64urlToBytes(opts.signatureB64);

  try {
    const key = createPublicKey({ key: opts.jwk, format: "jwk" } as JsonWebKeyInput);
    if (header.alg === "ES256") {
      // JWS ECDSA signatures are raw R||S (IEEE P1363), not DER.
      return nodeVerify("sha256", signingInput, { key, dsaEncoding: "ieee-p1363" }, signature);
    }
    if (header.alg === "RS256") {
      return nodeVerify("sha256", signingInput, key, signature);
    }
    if (header.alg === "EdDSA") {
      return nodeVerify(null, signingInput, key, signature);
    }
    return false;
  } catch {
    return false;
  }
}
