import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPair } from "../src/lib/crypto/ed25519";
import { encodePublicKey } from "../src/lib/crypto/multibase";
import { merkleRoot } from "../src/lib/transparency/merkle";
import {
  signTreeHead,
  verifyTreeHead,
  type TreeHead,
} from "../src/lib/transparency/sth";

const enc = (s: string) => new TextEncoder().encode(s);
const hex = (b: Uint8Array) =>
  [...b].map((x) => x.toString(16).padStart(2, "0")).join("");

test("sth: signs and verifies a tree head; tampering fails closed", () => {
  const { secretKey, publicKey } = generateKeyPair();
  const head: TreeHead = {
    log_id: "passportforagents.com/attestations",
    tree_size: 2,
    root_hash: hex(merkleRoot([enc("a"), enc("b")])),
    timestamp: "2026-06-07T00:00:00Z",
  };
  const sth = signTreeHead(head, secretKey);

  const r = verifyTreeHead(sth, {
    expectedIssuerKey: encodePublicKey(publicKey),
  });
  assert.equal(r.valid, true);
  assert.equal(r.signature_valid, true);
  assert.equal(r.issuer_matches, true);

  // every signed field is covered: tampering any of them breaks the signature
  assert.equal(verifyTreeHead({ ...sth, tree_size: 3 }).signature_valid, false);
  assert.equal(
    verifyTreeHead({ ...sth, root_hash: hex(merkleRoot([enc("x")])) })
      .signature_valid,
    false,
  );
  assert.equal(
    verifyTreeHead({ ...sth, timestamp: "2099-01-01T00:00:00Z" })
      .signature_valid,
    false,
  );
  // issuer pin
  assert.equal(
    verifyTreeHead(sth, { expectedIssuerKey: "z6MkWrongKey" }).issuer_matches,
    false,
  );
});
