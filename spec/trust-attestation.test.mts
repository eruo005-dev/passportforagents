import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPair } from "../src/lib/crypto/ed25519";
import {
  buildTrustAttestationBody,
  signTrustAttestation,
  verifyTrustAttestation,
} from "../src/lib/trust/attestation";

const COMPUTED_AT = "2026-06-05T00:00:00Z";
const subject = { agent_id: "agt_49e7k3c7bqcjr", owner_domain: "agoramind.ai" };
// domain_control(1)*0.3 + signed_provenance(1)*0.2 = 0.5 → score 50
const signals = [
  { signalType: "domain_control" as const, value: 1 },
  { signalType: "signed_provenance" as const, value: 1 },
];

function freshAttestation() {
  const { secretKey } = generateKeyPair();
  const body = buildTrustAttestationBody({ subject, signals, computed_at: COMPUTED_AT });
  return { att: signTrustAttestation(body, secretKey), secretKey };
}

test("attestation: score is independently reconstructable + verifies", () => {
  const { att } = freshAttestation();
  // Anyone can recompute the headline number from the public formula:
  assert.equal(att.score, 50);
  const r = verifyTrustAttestation(att);
  assert.equal(r.valid, true);
  assert.equal(r.recomputed_score, 50);
  assert.deepEqual(r.checks, {
    weights_canonical: true,
    contributions_consistent: true,
    score_recomputes: true,
    signature_valid: true,
    issuer_matches: true,
  });
  // Evidence pointers are present + point at re-derivable sources.
  const dc = att.breakdown.find((b) => b.signal_type === "domain_control")!;
  assert.match(dc.evidence, /agoramind\.ai\/\.well-known\/agent-passport\.json/);
});

test("attestation: faking the score fails closed (recompute + signature)", () => {
  const { att } = freshAttestation();
  att.score = 99; // claim a higher number
  const r = verifyTrustAttestation(att);
  assert.equal(r.recomputed_score, 50);
  assert.equal(r.checks.score_recomputes, false);
  assert.equal(r.checks.signature_valid, false); // signed bytes changed too
  assert.equal(r.valid, false);
});

test("attestation: inflating an input value without re-signing fails", () => {
  const { att } = freshAttestation();
  const row = att.breakdown.find((b) => b.signal_type === "user_rating")!;
  row.value = 1; // pretend a perfect rating
  row.contribution = 1 * row.weight; // even keep contribution self-consistent…
  const r = verifyTrustAttestation(att);
  // …the score no longer matches AND the signature no longer verifies.
  assert.equal(r.checks.score_recomputes, false);
  assert.equal(r.checks.signature_valid, false);
  assert.equal(r.valid, false);
});

test("attestation: silently re-weighting is rejected (canonical weights win)", () => {
  const { att } = freshAttestation();
  att.weights = { ...att.weights, domain_control: 0.9 };
  const r = verifyTrustAttestation(att);
  assert.equal(r.checks.weights_canonical, false);
  assert.equal(r.valid, false);
});

test("attestation: issuer key pin", () => {
  const { att } = freshAttestation();
  assert.equal(verifyTrustAttestation(att, { expectedIssuerKey: att.public_key }).valid, true);
  assert.equal(
    verifyTrustAttestation(att, { expectedIssuerKey: "z6MkWrongKeyXXXX" }).checks.issuer_matches,
    false,
  );
});
