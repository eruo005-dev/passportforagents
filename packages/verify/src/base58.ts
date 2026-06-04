/**
 * Minimal base58btc + multibase/Multikey decoding — inlined so the SDK has
 * ZERO npm dependencies (verification uses WebCrypto + these helpers only).
 */

const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

/** Decode a base58btc string to bytes (standard Bitcoin alphabet). */
export function base58decode(s: string): Uint8Array {
  const bytes: number[] = []; // seed empty so all-zero/empty inputs decode exactly
  for (const ch of s) {
    const val = ALPHABET.indexOf(ch);
    if (val < 0) throw new Error(`invalid base58 char: ${ch}`);
    let carry = val;
    for (let i = 0; i < bytes.length; i++) {
      carry += bytes[i] * 58;
      bytes[i] = carry & 0xff;
      carry = Math.floor(carry / 256);
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry = Math.floor(carry / 256);
    }
  }
  // Preserve leading zeros (encoded as '1').
  for (const ch of s) {
    if (ch === "1") bytes.push(0);
    else break;
  }
  return new Uint8Array(bytes.reverse());
}

const ED25519_PUB_MULTICODEC = [0xed, 0x01];

/** Decode a multibase Multikey (z…) to the raw 32-byte Ed25519 public key. */
export function decodePublicKey(multikey: string): Uint8Array {
  if (!multikey.startsWith("z")) throw new Error("expected base58btc multibase ('z')");
  const decoded = base58decode(multikey.slice(1));
  if (
    decoded.length !== 34 ||
    decoded[0] !== ED25519_PUB_MULTICODEC[0] ||
    decoded[1] !== ED25519_PUB_MULTICODEC[1]
  ) {
    throw new Error("not a valid ed25519-pub Multikey");
  }
  return decoded.slice(2);
}

/** Decode a base58btc multibase signature (z…) to raw 64 bytes. */
export function decodeSignature(multibaseSig: string): Uint8Array {
  if (!multibaseSig.startsWith("z")) throw new Error("expected base58btc multibase ('z')");
  const decoded = base58decode(multibaseSig.slice(1));
  if (decoded.length !== 64) throw new Error(`signature must be 64 bytes, got ${decoded.length}`);
  return decoded;
}
