import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPair } from "../src/lib/crypto/ed25519";
import { encodePublicKey } from "../src/lib/crypto/multibase";
import {
  signRevocationList,
  verifyRevocationList,
  isRevoked,
  checkRevoked,
  type RevocationListBody,
} from "../src/lib/transparency/revocation";

const body = (): RevocationListBody => ({
  list_id: "passportforagents.com/revocations",
  issuer_domain: "passportforagents.com",
  list_version: 3,
  issued_at: "2026-06-07T00:00:00Z",
  expires_at: "2026-06-14T00:00:00Z",
  entries: [
    { subject: "agt_compromised01", revoked_at: "2026-06-06T12:00:00Z", reason: "key_compromise" },
    { subject: "evil.example.com", revoked_at: "2026-06-05T00:00:00Z" },
  ],
});

test("revocation: signs, verifies, and membership works in both directions", () => {
  const { secretKey, publicKey } = generateKeyPair();
  const srl = signRevocationList(body(), secretKey);
  const v = verifyRevocationList(srl, {
    expectedIssuerKey: encodePublicKey(publicKey),
    now: "2026-06-08T00:00:00Z",
  });
  assert.equal(v.valid, true);
  assert.equal(v.issuer_matches, true);
  assert.equal(v.fresh, true);
  assert.equal(isRevoked(srl, "agt_compromised01"), true);
  assert.equal(isRevoked(srl, "evil.example.com"), true);
  assert.equal(isRevoked(srl, "agt_innocent"), false);
});

test("revocation: cannot silently erase a revocation (fail-closed)", () => {
  const { secretKey } = generateKeyPair();
  const srl = signRevocationList(body(), secretKey);
  // attacker drops the compromised agent to 'un-revoke' it
  const tampered = { ...srl, entries: srl.entries.filter((e) => e.subject !== "agt_compromised01") };
  assert.equal(verifyRevocationList(tampered).signature_valid, false);
  // ...or adds a bogus revocation, or edits an entry — all break the signature
  assert.equal(
    verifyRevocationList({ ...srl, entries: [...srl.entries, { subject: "agt_victim", revoked_at: "x" }] })
      .signature_valid,
    false,
  );
  const edited = structuredClone(srl);
  edited.entries[0].subject = "agt_someoneelse";
  assert.equal(verifyRevocationList(edited).signature_valid, false);
});

test("revocation: tampering then re-signing with an attacker key fails the pin", () => {
  const issuer = generateKeyPair();
  const pin = encodePublicKey(issuer.publicKey);
  // attacker erases a revocation and re-signs with their OWN key
  const attacker = generateKeyPair();
  const forged = signRevocationList(
    { ...body(), entries: body().entries.filter((e) => e.subject !== "agt_compromised01") },
    attacker.secretKey,
  );
  const v = verifyRevocationList(forged, { expectedIssuerKey: pin });
  assert.equal(v.signature_valid, true); // a valid signature…
  assert.equal(v.issuer_matches, false); // …but not the pinned issuer
  assert.equal(v.valid, false); // so the list is rejected
});

test("revocation: checkRevoked refuses to answer on an unverified list", () => {
  const { secretKey, publicKey } = generateKeyPair();
  const pin = encodePublicKey(publicKey);
  const srl = signRevocationList(body(), secretKey);

  const ok = checkRevoked(srl, "agt_compromised01", { expectedIssuerKey: pin, now: "2026-06-08T00:00:00Z" });
  assert.equal(ok.ok, true);
  assert.equal(ok.revoked, true);

  // tampered list → refuses (revoked: null), never a forged "not revoked"
  const tampered = { ...srl, entries: srl.entries.filter((e) => e.subject !== "agt_compromised01") };
  const bad = checkRevoked(tampered, "agt_compromised01", { expectedIssuerKey: pin });
  assert.equal(bad.ok, false);
  assert.equal(bad.revoked, null);

  // wrong issuer pin → refuses
  const wrongPin = checkRevoked(srl, "agt_compromised01", { expectedIssuerKey: "z6MkWrong" });
  assert.equal(wrongPin.ok, false);
  assert.equal(wrongPin.revoked, null);
});

test("revocation: expiry + issuer pin", () => {
  const { secretKey, publicKey } = generateKeyPair();
  const srl = signRevocationList(body(), secretKey);
  // expired
  assert.equal(verifyRevocationList(srl, { now: "2026-07-01T00:00:00Z" }).fresh, false);
  // still valid signature even when stale (liveness is orthogonal to integrity)
  assert.equal(verifyRevocationList(srl, { now: "2026-07-01T00:00:00Z" }).signature_valid, true);
  // wrong issuer pin
  assert.equal(
    verifyRevocationList(srl, { expectedIssuerKey: encodePublicKey(generateKeyPair().publicKey) }).valid,
    false,
  );
  void publicKey;
});
