/**
 * Ed25519 signing/verification helpers.
 *
 * @noble/ed25519 v3 ships without a bundled SHA-512 for synchronous use, so we
 * wire it once here (and only here). Everything else in the codebase imports
 * sign/verify from this module so the hash is always configured.
 */
import * as ed from "@noble/ed25519";
import { sha512 } from "@noble/hashes/sha2.js";

// Configure synchronous hashing exactly once at module load.
ed.hashes.sha512 = sha512;

export type KeyPair = {
  /** Raw 32-byte secret seed. */
  secretKey: Uint8Array;
  /** Raw 32-byte public key. */
  publicKey: Uint8Array;
};

/** Generate a fresh Ed25519 keypair. */
export function generateKeyPair(): KeyPair {
  const secretKey = ed.utils.randomSecretKey();
  const publicKey = ed.getPublicKey(secretKey);
  return { secretKey, publicKey };
}

/** Derive the public key from a secret seed. */
export function publicKeyFromSecret(secretKey: Uint8Array): Uint8Array {
  return ed.getPublicKey(secretKey);
}

/** Sign a message, returning a raw 64-byte signature. */
export function sign(message: Uint8Array, secretKey: Uint8Array): Uint8Array {
  return ed.sign(message, secretKey);
}

/** Verify a raw signature against a message and raw public key. */
export function verify(
  signature: Uint8Array,
  message: Uint8Array,
  publicKey: Uint8Array,
): boolean {
  try {
    return ed.verify(signature, message, publicKey);
  } catch {
    // Malformed signature / key bytes → treat as a failed verification, not a throw.
    return false;
  }
}
