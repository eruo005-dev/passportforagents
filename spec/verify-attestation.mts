#!/usr/bin/env -S npx tsx
/**
 * Standalone OFFLINE reference verifier for PassportForAgents Trust Attestations.
 *
 * Zero network, zero auth, zero dependence on the hosted service: it recomputes
 *   score = round(100 * Σ value*weight)
 * against the canonical weights and checks the issuer Ed25519 signature over the
 * JCS body — locally, in your hand. This is the thing every opaque-score
 * competitor structurally cannot offer.
 *
 *   npm run verify:attestation -- --file attestation.json [--now <iso>]
 *   npm run verify:attestation -- --demo      # build+sign+verify a sample, all local
 */
import { readFileSync } from "node:fs";
import { generateKeyPair } from "../src/lib/crypto/ed25519";
import {
  buildTrustAttestationBody,
  signTrustAttestation,
  verifyTrustAttestation,
  type TrustAttestation,
} from "../src/lib/trust/attestation";

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const mark = (b: boolean | null) => (b === true ? "✓" : b === false ? "✗" : "·");

function printReport(att: TrustAttestation, now?: string): boolean {
  const r = verifyTrustAttestation(att, { now });
  console.log(`\n  subject:            ${att.subject.agent_id} @ ${att.subject.owner_domain}`);
  console.log(`  issuer:             ${att.issuer_domain} (${att.public_key.slice(0, 16)}…)`);
  console.log(`  score (claimed):    ${att.score}`);
  console.log(`  score (recomputed): ${r.recomputed_score}`);
  console.log(`  ── independent checks (no network, no trust in issuer) ──`);
  console.log(`   ${mark(r.checks.weights_canonical)} weights are the canonical published weights`);
  console.log(`   ${mark(r.checks.contributions_consistent)} every contribution = value × weight`);
  console.log(`   ${mark(r.checks.score_recomputes)} score recomputes to the claimed number`);
  console.log(`   ${mark(r.checks.signature_valid)} Ed25519 signature verifies over the JCS body`);
  if (att.expires_at)
    console.log(
      `   ${mark(r.fresh)} fresh (expires ${att.expires_at}${now ? `, now ${now}` : ", pass --now to check"})`,
    );
  console.log(
    `\n  RESULT: ${
      r.valid ? "✓ VALID — recomputed + signature-verified, fully offline" : "✗ INVALID"
    }${r.error ? ` — ${r.error}` : ""}\n`,
  );
  return r.valid;
}

const now = arg("--now");

if (process.argv.includes("--demo")) {
  console.log("\nBuilding, signing, and verifying a sample attestation — entirely offline:");
  const { secretKey } = generateKeyPair();
  const att = signTrustAttestation(
    buildTrustAttestationBody({
      subject: { agent_id: "agt_demo", owner_domain: "example.com" },
      signals: [
        { signalType: "domain_control", value: 1 },
        { signalType: "signed_provenance", value: 1 },
        { signalType: "uptime", value: 0.8 },
      ],
      computed_at: "2026-06-05T00:00:00Z",
      expires_at: "2026-07-05T00:00:00Z",
    }),
    secretKey,
  );
  process.exitCode = printReport(att, now ?? "2026-06-10T00:00:00Z") ? 0 : 1;
} else {
  const file = arg("--file") ?? process.argv.slice(2).find((a) => !a.startsWith("--"));
  if (!file) {
    console.error(
      "usage: npm run verify:attestation -- --file <attestation.json> [--now <iso>]\n" +
        "       npm run verify:attestation -- --demo",
    );
    process.exit(2);
  }
  let att: TrustAttestation;
  try {
    att = JSON.parse(readFileSync(file, "utf8")) as TrustAttestation;
  } catch (e) {
    console.error(`could not read/parse attestation at ${file}: ${(e as Error).message}`);
    process.exit(2);
  }
  process.exitCode = printReport(att, now) ? 0 : 1;
}
