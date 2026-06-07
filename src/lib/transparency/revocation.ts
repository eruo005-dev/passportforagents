/**
 * Signed Revocation List (a CRL analog) for the transparency layer.
 *
 * Closes the audit's P0 "no key revocation mechanism." The issuer
 * (passportforagents.com) publishes a SIGNED list of revoked subjects — an
 * agent public id (`agt_…`), an owner domain, or a key Multikey — that a
 * verifier honors REGARDLESS of what the subject's domain still serves. Because
 * the single signature covers the whole `entries` array, nobody can silently
 * add, drop, or edit a revocation without breaking verification (fail-closed):
 * a verifier trusts the entire list or none of it. Each list is also appended
 * to the transparency log, so the registry can't quietly change history either.
 *
 * Pure (JCS + Ed25519 + multibase) — import-safe in the standalone verifier and
 * the browser; no DB, no `server-only`, no network.
 */
import { jcsCanonicalizeBytes } from "../crypto/jcs";
import {
  sign as edSign,
  verify as edVerify,
  publicKeyFromSecret,
} from "../crypto/ed25519";
import {
  encodePublicKey,
  decodePublicKey,
  encodeSignature,
  decodeSignature,
} from "../crypto/multibase";

export type RevocationEntry = {
  /** Revoked subject: an agent public id (`agt_…`), an owner domain, or a key
   *  Multikey. Compared verbatim (case-sensitive). */
  subject: string;
  /** RFC 3339 time the revocation took effect. */
  revoked_at: string;
  /** Optional machine-readable reason, e.g. "key_compromise", "superseded". */
  reason?: string;
};

export type RevocationListBody = {
  /** Stable list identifier, e.g. "passportforagents.com/revocations". */
  list_id: string;
  /** Domain whose key signs this list. */
  issuer_domain: string;
  /** Monotonic version; a higher version supersedes a lower one. */
  list_version: number;
  /** RFC 3339 issuance time. */
  issued_at: string;
  /** Optional RFC 3339 expiry — a stale list should not be trusted as current. */
  expires_at?: string;
  entries: RevocationEntry[];
};

export type SignedRevocationList = RevocationListBody & {
  public_key: string;
  signature: string;
};

/** Bytes the signature covers: the JCS-canonicalized list body. */
function revocationSigningBytes(body: RevocationListBody): Uint8Array {
  return jcsCanonicalizeBytes(body);
}

/** Sign a revocation list with the issuer Ed25519 seed. */
export function signRevocationList(
  body: RevocationListBody,
  secretKey: Uint8Array,
): SignedRevocationList {
  const sig = edSign(revocationSigningBytes(body), secretKey);
  return {
    ...body,
    public_key: encodePublicKey(publicKeyFromSecret(secretKey)),
    signature: encodeSignature(sig),
  };
}

export type RevocationListVerification = {
  valid: boolean;
  signature_valid: boolean;
  issuer_matches: boolean;
  /** Liveness vs `expires_at`: true/false when both are known, else null. */
  fresh: boolean | null;
  error?: string;
};

/**
 * Verify a revocation list's signature (and optionally pin the issuer + check
 * freshness). NOTE: omitting `expectedIssuerKey` checks only the list's internal
 * self-consistency — it is NOT a trust anchor (anyone can sign a forged list
 * with their own key). Production callers MUST pin the issuer key.
 */
export function verifyRevocationList(
  srl: SignedRevocationList,
  opts?: { expectedIssuerKey?: string; now?: string },
): RevocationListVerification {
  const issuer_matches = opts?.expectedIssuerKey
    ? srl.public_key === opts.expectedIssuerKey
    : true;

  let fresh: boolean | null = null;
  if (srl.expires_at && opts?.now) {
    const exp = Date.parse(srl.expires_at);
    const now = Date.parse(opts.now);
    // Fail closed: an unparseable signed expiry reads as stale.
    fresh = !Number.isFinite(now) ? null : Number.isFinite(exp) ? now < exp : false;
  }

  try {
    const { public_key, signature, ...body } = srl;
    const pub = decodePublicKey(public_key);
    const sig = decodeSignature(signature);
    const signature_valid = edVerify(sig, revocationSigningBytes(body), pub);
    return { valid: signature_valid && issuer_matches, signature_valid, issuer_matches, fresh };
  } catch (e) {
    return {
      valid: false,
      signature_valid: false,
      issuer_matches,
      fresh,
      error: (e as Error).message,
    };
  }
}

/**
 * Membership lookup on a revocation list. The caller MUST first confirm the
 * list verifies (`verifyRevocationList(...).valid === true`); this is a plain
 * lookup. Because the single signature covers the whole `entries` array, a
 * verified list's answer is trustworthy in BOTH directions — an attacker can
 * neither forge a revocation nor erase one without failing verification.
 */
export function isRevoked(srl: SignedRevocationList, subject: string): boolean {
  return srl.entries.some((e) => e.subject === subject);
}

export type RevocationCheck = {
  /** Whether the answer is trustworthy: the list verified (and matched the
   *  issuer pin, if one was supplied). When false, ignore `revoked`. */
  ok: boolean;
  /** true = subject is revoked; false = absent from a VERIFIED list; null = the
   *  list did not verify, so revocation status is unknown. */
  revoked: boolean | null;
  verification: RevocationListVerification;
};

/**
 * Safe, combined revocation check — prefer this at call sites over calling
 * `isRevoked` directly. It verifies the list first and REFUSES to give a
 * revocation answer (`revoked: null`, `ok: false`) unless the list
 * cryptographically verifies, closing the "answer on a forged list" foot-gun.
 * Pass `expectedIssuerKey` in production (the trust anchor), and pass `now` to
 * surface staleness — a withheld/old list can hide a recent revocation, so a
 * caller should treat `verification.fresh === false` as suspect.
 */
export function checkRevoked(
  srl: SignedRevocationList,
  subject: string,
  opts?: { expectedIssuerKey?: string; now?: string },
): RevocationCheck {
  const verification = verifyRevocationList(srl, opts);
  if (!verification.valid) return { ok: false, revoked: null, verification };
  return { ok: true, revoked: isRevoked(srl, subject), verification };
}
