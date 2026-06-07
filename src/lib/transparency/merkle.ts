/**
 * Append-only Merkle log core — RFC 6962 (Certificate Transparency) hashing.
 *
 * This is the cryptographic heart of "CT for agents": a tamper-evident,
 * append-only log of signed attestations / passports / revocations. The deep
 * moat — a registry that *cannot* rewrite history, verifiable by anyone with no
 * trust in us. We follow RFC 6962 (the same construction as Certificate
 * Transparency and Sigstore Rekor) for instant, well-understood credibility.
 *
 * Increment 1 (this file): leaf hashing, Merkle Tree Hash (root), and inclusion
 * (audit) proofs + a stand-alone verifier. Consistency proofs (the append-only
 * guarantee) + a signed tree head + public endpoints are increment 2.
 *
 * Pure and dependency-light (only @noble/hashes): no DB, no `server-only`, no
 * network — import-safe in the standalone reference verifier, in a browser, and
 * on the server alike.
 *
 * Domain separation (RFC 6962 §2.1):
 *   leaf hash = SHA-256(0x00 || entry)
 *   node hash = SHA-256(0x01 || left || right)
 *   empty root = SHA-256("")
 */
import { sha256 } from "@noble/hashes/sha2.js";

const LEAF_PREFIX = 0x00;
const NODE_PREFIX = 0x01;

function concat(...parts: Uint8Array[]): Uint8Array {
  const len = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(len);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}

/** RFC 6962 leaf hash of a log entry: SHA-256(0x00 || entry). */
export function leafHash(entry: Uint8Array): Uint8Array {
  return sha256(concat(Uint8Array.of(LEAF_PREFIX), entry));
}

/** RFC 6962 internal node hash: SHA-256(0x01 || left || right). */
function nodeHash(left: Uint8Array, right: Uint8Array): Uint8Array {
  return sha256(concat(Uint8Array.of(NODE_PREFIX), left, right));
}

/** Largest power of two STRICTLY less than n (n > 1). */
function largestPow2LessThan(n: number): number {
  let k = 1;
  while (k << 1 < n) k <<= 1;
  return k;
}

/** Merkle Tree Hash over an array of leaf hashes (RFC 6962 MTH). */
function mth(leaves: Uint8Array[]): Uint8Array {
  const n = leaves.length;
  if (n === 1) return leaves[0];
  const k = largestPow2LessThan(n);
  return nodeHash(mth(leaves.slice(0, k)), mth(leaves.slice(k)));
}

// Length-checked byte compare. NOT constant-time — fine here because the
// expected root is public/signed, never secret. Do not reuse for secrets.
const eq = (a: Uint8Array, b: Uint8Array) =>
  a.length === b.length && a.every((v, i) => v === b[i]);

/** Root hash of a tree over `entries` (raw entry bytes). Empty → SHA-256(""). */
export function merkleRoot(entries: Uint8Array[]): Uint8Array {
  if (entries.length === 0) return sha256(new Uint8Array());
  return mth(entries.map(leafHash));
}

/** RFC 6962 audit path (PATH) for the `index`-th leaf, over leaf hashes. */
function path(index: number, leaves: Uint8Array[]): Uint8Array[] {
  const n = leaves.length;
  if (n === 1) return [];
  const k = largestPow2LessThan(n);
  if (index < k) {
    return [...path(index, leaves.slice(0, k)), mth(leaves.slice(k))];
  }
  return [...path(index - k, leaves.slice(k)), mth(leaves.slice(0, k))];
}

/**
 * Inclusion (audit) proof for the entry at `index` in a tree over `entries`.
 * Throws on an out-of-range index — generation is a trusted server-side op; the
 * untrusted boundary is the verifier (`rootFromInclusionProof`), which instead
 * returns null.
 */
export function inclusionProof(
  entries: Uint8Array[],
  index: number,
): Uint8Array[] {
  if (index < 0 || index >= entries.length)
    throw new RangeError("index out of range");
  return path(index, entries.map(leafHash));
}

/**
 * Reconstruct the root implied by an inclusion proof (RFC 6962 §2.1.1
 * verification). Returns null on a malformed proof. The caller compares the
 * result to the trusted (signed) root — trusting no central party.
 */
export function rootFromInclusionProof(
  leafIndex: number,
  treeSize: number,
  leaf: Uint8Array,
  proof: Uint8Array[],
): Uint8Array | null {
  if (leafIndex < 0 || leafIndex >= treeSize) return null;
  let fn = leafIndex;
  let sn = treeSize - 1;
  let r = leaf;
  for (const p of proof) {
    if (sn === 0) return null; // proof too long
    if ((fn & 1) === 1 || fn === sn) {
      r = nodeHash(p, r);
      if ((fn & 1) === 0) {
        do {
          fn >>= 1;
          sn >>= 1;
        } while ((fn & 1) === 0 && fn !== 0);
      }
    } else {
      r = nodeHash(r, p);
    }
    fn >>= 1;
    sn >>= 1;
  }
  return sn === 0 ? r : null; // proof too short otherwise
}

/**
 * Verify that `entry` is the leaf at `leafIndex` in a tree of `treeSize` whose
 * root is `expectedRoot`, using only the proof — no access to the full log.
 */
export function verifyInclusion(args: {
  entry: Uint8Array;
  leafIndex: number;
  treeSize: number;
  proof: Uint8Array[];
  expectedRoot: Uint8Array;
}): boolean {
  const got = rootFromInclusionProof(
    args.leafIndex,
    args.treeSize,
    leafHash(args.entry),
    args.proof,
  );
  return got !== null && eq(got, args.expectedRoot);
}
