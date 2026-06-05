import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPair } from "../src/lib/crypto/ed25519";
import { encodePublicKey } from "../src/lib/crypto/multibase";
import { verifyTrustAttestation } from "../src/lib/trust/attestation";
import { issuerConfigured, issueTrustAttestation } from "../src/lib/trust/issuer";

const subject = { agent_id: "agt_test", owner_domain: "example.com" };
const signals = [{ signalType: "domain_control" as const, value: 1 }];
const NOW = new Date("2026-06-05T00:00:00Z");

test("issuer: fail-safe (no signing) when key unset or malformed", () => {
  delete process.env.PASSPORTFORAGENTS_ISSUER_SECRET_KEY;
  assert.equal(issuerConfigured(), false);
  assert.equal(issueTrustAttestation({ subject, signals, now: NOW }), null);
  process.env.PASSPORTFORAGENTS_ISSUER_SECRET_KEY = "not-hex";
  assert.equal(issuerConfigured(), false); // malformed → still fail-safe
  delete process.env.PASSPORTFORAGENTS_ISSUER_SECRET_KEY;
});

test("issuer: signs an independently-verifiable attestation from the env key", () => {
  const { secretKey, publicKey } = generateKeyPair();
  process.env.PASSPORTFORAGENTS_ISSUER_SECRET_KEY = [...secretKey]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  assert.equal(issuerConfigured(), true);

  const att = issueTrustAttestation({ subject, signals, now: NOW });
  assert.ok(att);
  // 7-day freshness window stapled in
  assert.equal(att!.computed_at, "2026-06-05T00:00:00.000Z");
  assert.equal(att!.expires_at, "2026-06-12T00:00:00.000Z");
  // verifies, signed by exactly the configured issuer key, fresh the next day
  const r = verifyTrustAttestation(att!, {
    expectedIssuerKey: encodePublicKey(publicKey),
    now: "2026-06-06T00:00:00Z",
  });
  assert.equal(r.valid, true);
  assert.equal(r.checks.issuer_matches, true);
  assert.equal(r.fresh, true);
  delete process.env.PASSPORTFORAGENTS_ISSUER_SECRET_KEY;
});
