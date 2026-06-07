import { test } from "node:test";
import assert from "node:assert/strict";
import {
  leafHash,
  merkleRoot,
  inclusionProof,
  rootFromInclusionProof,
  verifyInclusion,
  consistencyProof,
  verifyConsistency,
} from "../src/lib/transparency/merkle";

const enc = (s: string) => new TextEncoder().encode(s);
const entries = (n: number) =>
  Array.from({ length: n }, (_, i) => enc(`entry-${i}`));

const hex = (b: Uint8Array) =>
  [...b].map((x) => x.toString(16).padStart(2, "0")).join("");

test("merkle: empty root is SHA-256(''); single-leaf root is its leaf hash", () => {
  // RFC 6962 known-answer: empty tree hash == SHA-256("") (pins an external
  // constant, so a same-drift bug in both gen+verify can't hide).
  assert.equal(
    hex(merkleRoot([])),
    "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  );
  const one = entries(1);
  assert.deepEqual([...merkleRoot(one)], [...leafHash(one[0])]);
});

test("merkle: inclusion proofs verify for every index, tree sizes 1..16", () => {
  for (let n = 1; n <= 16; n++) {
    const es = entries(n);
    const root = merkleRoot(es);
    for (let i = 0; i < n; i++) {
      const proof = inclusionProof(es, i);
      // The proof reconstructs the INDEPENDENTLY-computed root — no full tree.
      const got = rootFromInclusionProof(i, n, leafHash(es[i]), proof);
      assert.ok(got, `null root for n=${n} i=${i}`);
      assert.deepEqual([...got!], [...root], `root mismatch n=${n} i=${i}`);
      assert.equal(
        verifyInclusion({
          entry: es[i],
          leafIndex: i,
          treeSize: n,
          proof,
          expectedRoot: root,
        }),
        true,
        `verify n=${n} i=${i}`,
      );
    }
  }
});

test("merkle: tampering fails closed", () => {
  const es = entries(7);
  const root = merkleRoot(es);
  const proof = inclusionProof(es, 3);
  const v = (o: Partial<Parameters<typeof verifyInclusion>[0]>) =>
    verifyInclusion({
      entry: es[3],
      leafIndex: 3,
      treeSize: 7,
      proof,
      expectedRoot: root,
      ...o,
    });

  assert.equal(v({ entry: enc("evil") }), false); // wrong entry
  assert.equal(v({ leafIndex: 2 }), false); // wrong index
  assert.equal(v({ expectedRoot: merkleRoot(entries(8)) }), false); // wrong root
  // flipped proof byte
  const bad = proof.map((p) => p.slice());
  bad[0][0] ^= 0xff;
  assert.equal(v({ proof: bad }), false);
  // out-of-range index → null (not a throw)
  assert.equal(rootFromInclusionProof(7, 7, leafHash(es[0]), proof), null);
});

test("merkle: consistency proofs verify the append-only prefix, all 0<m<n<=16", () => {
  for (let n = 2; n <= 16; n++) {
    const es = entries(n);
    const rootN = merkleRoot(es);
    for (let m = 1; m < n; m++) {
      const rootM = merkleRoot(es.slice(0, m));
      const proof = consistencyProof(es, m);
      assert.equal(
        verifyConsistency({
          first: m,
          second: n,
          proof,
          firstRoot: rootM,
          secondRoot: rootN,
        }),
        true,
        `consistency m=${m} n=${n}`,
      );
    }
  }
});

test("merkle: consistency fails closed on a rewritten/forked history", () => {
  const es = entries(11);
  const rootN = merkleRoot(es);
  const m = 6;
  const rootM = merkleRoot(es.slice(0, m));
  const proof = consistencyProof(es, m);
  const v = (o: Partial<Parameters<typeof verifyConsistency>[0]>) =>
    verifyConsistency({
      first: m,
      second: 11,
      proof,
      firstRoot: rootM,
      secondRoot: rootN,
      ...o,
    });
  assert.equal(v({ firstRoot: merkleRoot(es.slice(0, 5)) }), false); // forged old root
  assert.equal(v({ secondRoot: merkleRoot(entries(12)) }), false); // forged new root
  const bad = proof.map((p) => p.slice());
  bad[0][0] ^= 0xff;
  assert.equal(v({ proof: bad }), false); // flipped proof byte
  assert.equal(v({ first: 0 }), false); // out of range
  assert.equal(v({ first: 11 }), false); // first == second
});

test("merkle: append changes the root; old proofs still verify vs the old root", () => {
  const es7 = entries(7);
  const root7 = merkleRoot(es7);
  const root8 = merkleRoot(entries(8));
  assert.notDeepEqual([...root7], [...root8]); // appending changes the head
  const proof = inclusionProof(es7, 3);
  assert.equal(
    verifyInclusion({
      entry: es7[3],
      leafIndex: 3,
      treeSize: 7,
      proof,
      expectedRoot: root7,
    }),
    true,
  );
});
