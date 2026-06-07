/**
 * Signed Tree Head (STH) for the transparency log.
 *
 * The log periodically publishes a signed commitment to its current state —
 * {log_id, tree_size, root_hash, timestamp} signed with the issuer Ed25519 key.
 * Monitors verify the signature and check a consistency proof between two STHs
 * to prove the log is append-only (it never rewrote history). This is the
 * Sigstore/CT "signed tree head" pattern.
 *
 * Pure (JCS + Ed25519 + multibase) — import-safe in the standalone reference
 * verifier and the browser; no DB, no `server-only`, no network.
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

export type TreeHead = {
  /** Stable log identifier, e.g. "passportforagents.com/attestations". */
  log_id: string;
  /** Number of entries committed by this head. */
  tree_size: number;
  /** Hex-encoded Merkle root over the `tree_size` entries. */
  root_hash: string;
  /** RFC 3339 timestamp the head was issued. */
  timestamp: string;
};

export type SignedTreeHead = TreeHead & {
  /** Issuer Ed25519 public key (multibase Multikey). */
  public_key: string;
  /** Ed25519 signature over the JCS-canonicalized TreeHead (multibase). */
  signature: string;
};

/** Bytes the STH signature covers: the JCS-canonicalized TreeHead. */
function sthSigningBytes(head: TreeHead): Uint8Array {
  return jcsCanonicalizeBytes(head);
}

/** Sign a tree head with the log's issuer Ed25519 seed. */
export function signTreeHead(
  head: TreeHead,
  secretKey: Uint8Array,
): SignedTreeHead {
  const sig = edSign(sthSigningBytes(head), secretKey);
  return {
    ...head,
    public_key: encodePublicKey(publicKeyFromSecret(secretKey)),
    signature: encodeSignature(sig),
  };
}

export type TreeHeadVerification = {
  valid: boolean;
  signature_valid: boolean;
  issuer_matches: boolean;
  error?: string;
};

/** Verify an STH signature (and optionally pin the issuer key). */
export function verifyTreeHead(
  sth: SignedTreeHead,
  opts?: { expectedIssuerKey?: string },
): TreeHeadVerification {
  const issuer_matches = opts?.expectedIssuerKey
    ? sth.public_key === opts.expectedIssuerKey
    : true;
  try {
    const { public_key, signature, ...head } = sth;
    const pub = decodePublicKey(public_key);
    const sig = decodeSignature(signature);
    const signature_valid = edVerify(sig, sthSigningBytes(head), pub);
    return { valid: signature_valid && issuer_matches, signature_valid, issuer_matches };
  } catch (e) {
    return {
      valid: false,
      signature_valid: false,
      issuer_matches,
      error: (e as Error).message,
    };
  }
}
