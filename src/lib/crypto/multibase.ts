/**
 * Multibase / Multikey encoding for Ed25519 keys and signatures.
 *
 * Public keys are encoded as a `did:key`-compatible Multikey:
 *   multibase(base58btc, multicodec(ed25519-pub) || rawPublicKey)
 *   → "z" + base58btc( 0xed 0x01 || <32 key bytes> )
 *
 * Signatures are encoded as plain base58btc multibase (no multicodec prefix):
 *   "z" + base58btc(<64 signature bytes>)
 *
 * Encoding the KEY with a self-describing multicodec prefix is what lets the
 * identity primitive be swapped later (a different key type just carries a
 * different multicodec) without touching the registry/reputation layer.
 */
import { base58 } from "@scure/base";

// Varint-encoded multicodec for "ed25519-pub" (0xed) → bytes [0xed, 0x01].
const ED25519_PUB_MULTICODEC = Uint8Array.from([0xed, 0x01]);
const MULTIBASE_BASE58BTC = "z";

function concatBytes(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

/** Encode a raw 32-byte Ed25519 public key as a multibase Multikey string. */
export function encodePublicKey(rawKey: Uint8Array): string {
  if (rawKey.length !== 32) {
    throw new Error(`Ed25519 public key must be 32 bytes, got ${rawKey.length}`);
  }
  const prefixed = concatBytes(ED25519_PUB_MULTICODEC, rawKey);
  return MULTIBASE_BASE58BTC + base58.encode(prefixed);
}

/** Decode a multibase Multikey string back to the raw 32-byte Ed25519 key. */
export function decodePublicKey(multikey: string): Uint8Array {
  if (!multikey.startsWith(MULTIBASE_BASE58BTC)) {
    throw new Error("Unsupported multibase prefix (expected base58btc 'z')");
  }
  const decoded = base58.decode(multikey.slice(1));
  if (
    decoded.length !== 34 ||
    decoded[0] !== ED25519_PUB_MULTICODEC[0] ||
    decoded[1] !== ED25519_PUB_MULTICODEC[1]
  ) {
    throw new Error("Not a valid ed25519-pub Multikey");
  }
  return decoded.slice(2);
}

/** Encode a raw 64-byte Ed25519 signature as a base58btc multibase string. */
export function encodeSignature(rawSig: Uint8Array): string {
  if (rawSig.length !== 64) {
    throw new Error(`Ed25519 signature must be 64 bytes, got ${rawSig.length}`);
  }
  return MULTIBASE_BASE58BTC + base58.encode(rawSig);
}

/** Decode a base58btc multibase signature string to raw 64 bytes. */
export function decodeSignature(multibaseSig: string): Uint8Array {
  if (!multibaseSig.startsWith(MULTIBASE_BASE58BTC)) {
    throw new Error("Unsupported multibase prefix (expected base58btc 'z')");
  }
  const decoded = base58.decode(multibaseSig.slice(1));
  if (decoded.length !== 64) {
    throw new Error(`Decoded signature must be 64 bytes, got ${decoded.length}`);
  }
  return decoded;
}
