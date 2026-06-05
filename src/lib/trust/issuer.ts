import "server-only";
import {
  buildTrustAttestationBody,
  signTrustAttestation,
  type TrustAttestation,
} from "./attestation";
import type { ScoreInput } from "./score";

/** Freshness window for issued attestations (7 days). */
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Load the issuer Ed25519 seed from env. Returns null (fail-safe) when unset or
 * malformed — callers turn that into a 503 rather than signing with a bad key.
 * Read at call time (not import time) so tests can set/clear it per case.
 */
function loadIssuerSeed(): Uint8Array | null {
  const hex = process.env.PASSPORTFORAGENTS_ISSUER_SECRET_KEY?.trim();
  if (!hex || !/^[0-9a-f]{64}$/i.test(hex)) return null;
  return Uint8Array.from(hex.match(/.{2}/g)!.map((b) => parseInt(b, 16)));
}

/** Whether a usable issuer key is configured. */
export function issuerConfigured(): boolean {
  return loadIssuerSeed() !== null;
}

/**
 * Sign a Trust Attestation for an agent with the passportforagents.com issuer
 * key. Returns null when no issuer key is configured (route → 503). `now` is
 * injected so the function stays pure/testable.
 */
export function issueTrustAttestation(args: {
  subject: { agent_id: string; owner_domain: string };
  signals: ScoreInput[];
  now: Date;
}): TrustAttestation | null {
  const seed = loadIssuerSeed();
  if (!seed) return null;
  const body = buildTrustAttestationBody({
    subject: args.subject,
    signals: args.signals,
    computed_at: args.now.toISOString(),
    expires_at: new Date(args.now.getTime() + TTL_MS).toISOString(),
  });
  return signTrustAttestation(body, seed);
}
