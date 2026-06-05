/**
 * Signed, independently-recomputable Trust Attestation.
 *
 * Every competitor hands you an OPAQUE trust/risk number ("trust our score").
 * PassportForAgents hands you a number you can reconstruct from scratch:
 *
 *   - the exact formula and the canonical weights are inside the signed body,
 *   - every input signal carries its value AND an `evidence` pointer where the
 *     value can be independently re-derived,
 *   - the issuer's Ed25519 signature commits to all of it.
 *
 * A verifier therefore needs to trust NO central party. It (1) recomputes
 *   score = round(100 * Σ value[type] * weight[type])
 * against the *canonical* published weights, (2) confirms the body's weights
 * equal those canonical weights, and (3) checks the signature over the
 * JCS-canonicalized body. All three are pure crypto/arithmetic with zero
 * dependence on the hosted service — so this module is import-safe in the
 * standalone reference verifier (no `server-only`, no DB).
 *
 * Full rationale: docs/trust-score.md (formula) + SPEC.md (signing).
 */
import { jcsCanonicalizeBytes } from "../crypto/jcs";
import { sign as edSign, verify as edVerify, publicKeyFromSecret } from "../crypto/ed25519";
import {
  encodePublicKey,
  decodePublicKey,
  encodeSignature,
  decodeSignature,
} from "../crypto/multibase";
import { TRUST_WEIGHTS, type TrustSignalType } from "./weights";
import { computeTrustScore, type ScoreInput } from "./score";

export const TRUST_ATTESTATION_SPEC = "1.0.0";
export const TRUST_SCORE_FORMULA =
  "score = round(100 * sum_over_types( value[type] * weight[type] ))";

/** Tolerance for float contributions; the score itself is integer-rounded. */
const EPSILON = 1e-9;

export type AttestationSubject = {
  /** Stable public identifier, e.g. an `agt_…` id (or domain for a root agent). */
  agent_id: string;
  /** Domain that anchors the identity (the root of trust). */
  owner_domain: string;
};

export type AttestationSignalRow = {
  signal_type: TrustSignalType;
  value: number; // 0..1
  weight: number; // 0..1 (canonical)
  contribution: number; // value * weight
  /** Where this value can be independently re-derived by a third party. */
  evidence: string;
};

export type TrustAttestationBody = {
  trust_spec_version: string;
  formula: string;
  issuer_domain: string;
  subject: AttestationSubject;
  /** Snapshot of the canonical weights, so recomputation is unambiguous. */
  weights: Record<TrustSignalType, number>;
  score: number; // 0..100 integer
  breakdown: AttestationSignalRow[];
  /** RFC 3339 timestamp of computation (passed in — keeps this fn pure). */
  computed_at: string;
  /** Optional RFC 3339 expiry — issuer-chosen freshness window. Additive and
   *  covered by the signature; absent = no expiry. Lets a verifier decide
   *  `fresh` fully OFFLINE, with no live call to us (OCSP-stapling analog). */
  expires_at?: string;
};

export type TrustAttestation = TrustAttestationBody & {
  /** Issuer Ed25519 public key (multibase Multikey). */
  public_key: string;
  /** Detached Ed25519 signature over the JCS-canonicalized body (multibase). */
  signature: string;
};

/** Canonical "where to re-derive this value" pointer for a signal type. */
function defaultEvidenceRef(
  type: TrustSignalType,
  subject: AttestationSubject,
  issuerDomain: string,
): string {
  const wellKnown = `https://${subject.owner_domain}/.well-known/agent-passport.json`;
  const api = `https://${issuerDomain}/api/v1`;
  const id = encodeURIComponent(subject.agent_id);
  switch (type) {
    case "domain_control":
      return wellKnown;
    case "signed_provenance":
      return `${wellKnown}#signature`;
    case "registry_presence":
      return `${api}/registry?agent=${id}`;
    case "user_rating":
      return `${api}/reviews?agent=${id}`;
    case "uptime":
      return `${api}/uptime?agent=${id}`;
    case "secret_hygiene":
      return `${api}/scan?agent=${id}`;
    default:
      return `${api}/verify?agent=${id}`;
  }
}

/**
 * Assemble an unsigned attestation body from raw signals. Pure & deterministic:
 * `computed_at` is passed in so callers control time (testable, replayable).
 */
export function buildTrustAttestationBody(args: {
  subject: AttestationSubject;
  signals: ScoreInput[];
  computed_at: string;
  /** Optional issuer-chosen expiry (RFC 3339) for offline freshness checks. */
  expires_at?: string;
  issuer_domain?: string;
  /** Optional override evidence pointers per signal type. */
  evidence?: Partial<Record<TrustSignalType, string>>;
}): TrustAttestationBody {
  const issuer_domain = args.issuer_domain ?? "passportforagents.com";
  const { score, breakdown } = computeTrustScore(args.signals);
  return {
    trust_spec_version: TRUST_ATTESTATION_SPEC,
    formula: TRUST_SCORE_FORMULA,
    issuer_domain,
    subject: args.subject,
    weights: { ...TRUST_WEIGHTS },
    score,
    breakdown: breakdown.map((r) => ({
      signal_type: r.signalType,
      value: r.value,
      weight: r.weight,
      contribution: r.contribution,
      evidence:
        args.evidence?.[r.signalType] ??
        defaultEvidenceRef(r.signalType, args.subject, issuer_domain),
    })),
    computed_at: args.computed_at,
    ...(args.expires_at ? { expires_at: args.expires_at } : {}),
  };
}

/** Bytes the signature covers: the JCS-canonicalized body (no key/signature). */
function attestationSigningBytes(body: TrustAttestationBody): Uint8Array {
  return jcsCanonicalizeBytes(body);
}

/** Sign an attestation body with an issuer Ed25519 secret seed. */
export function signTrustAttestation(
  body: TrustAttestationBody,
  secretKey: Uint8Array,
): TrustAttestation {
  const sig = edSign(attestationSigningBytes(body), secretKey);
  return {
    ...body,
    public_key: encodePublicKey(publicKeyFromSecret(secretKey)),
    signature: encodeSignature(sig),
  };
}

export type AttestationVerification = {
  valid: boolean;
  checks: {
    /** body.weights deep-equals the canonical published TRUST_WEIGHTS. */
    weights_canonical: boolean;
    /** every row.contribution === value * (canonical) weight. */
    contributions_consistent: boolean;
    /** round(100 * Σ value*weight) recomputes to body.score. */
    score_recomputes: boolean;
    /** Ed25519 signature verifies over JCS(body) against public_key. */
    signature_valid: boolean;
    /** issuer key matches a pinned expectation (only when one is supplied). */
    issuer_matches: boolean;
  };
  recomputed_score: number;
  /** Liveness verdict vs `expires_at`: true/false when BOTH expiry and `now`
   *  are known, else null. Deliberately independent of `valid` (integrity) —
   *  same split as the rest of the product: verified ≠ fresh. */
  fresh: boolean | null;
  error?: string;
};

/**
 * Verify a Trust Attestation with ZERO trust in the issuer's claim. Recomputes
 * the score against the *canonical* weights (not the self-declared ones), so an
 * attacker can't quietly re-weight to inflate a number — and checks the issuer
 * signature. Optionally pins the issuer key.
 */
export function verifyTrustAttestation(
  att: TrustAttestation,
  opts?: { expectedIssuerKey?: string; now?: string },
): AttestationVerification {
  const checks = {
    weights_canonical: false,
    contributions_consistent: false,
    score_recomputes: false,
    signature_valid: false,
    issuer_matches: opts?.expectedIssuerKey ? false : true,
  };
  let recomputed_score = NaN;

  try {
    const { public_key, signature, ...body } = att;

    // 1. Weights must be exactly the canonical published set.
    const canonicalTypes = Object.keys(TRUST_WEIGHTS) as TrustSignalType[];
    checks.weights_canonical =
      !!body.weights &&
      Object.keys(body.weights).length === canonicalTypes.length &&
      canonicalTypes.every(
        (t) => Math.abs((body.weights[t] ?? NaN) - TRUST_WEIGHTS[t]) < EPSILON,
      );

    // 2. Recompute the score from the breakdown VALUES against canonical weights.
    let sum = 0;
    let contributionsOk = body.breakdown.length === canonicalTypes.length;
    for (const row of body.breakdown) {
      const w = TRUST_WEIGHTS[row.signal_type as TrustSignalType];
      if (w === undefined) {
        contributionsOk = false;
        continue;
      }
      const expectedContribution = row.value * w;
      if (Math.abs(expectedContribution - row.contribution) > 1e-6)
        contributionsOk = false;
      sum += expectedContribution;
    }
    checks.contributions_consistent = contributionsOk;
    recomputed_score = Math.max(0, Math.min(100, Math.round(100 * sum)));
    checks.score_recomputes = recomputed_score === body.score;

    // 3. Signature over the canonical body bytes.
    const pub = decodePublicKey(public_key);
    const sig = decodeSignature(signature);
    checks.signature_valid = edVerify(sig, attestationSigningBytes(body), pub);

    // 4. Optional issuer pin.
    if (opts?.expectedIssuerKey)
      checks.issuer_matches = public_key === opts.expectedIssuerKey;
  } catch (e) {
    return {
      valid: false,
      checks,
      recomputed_score,
      fresh: null,
      error: (e as Error).message,
    };
  }

  const valid =
    checks.weights_canonical &&
    checks.contributions_consistent &&
    checks.score_recomputes &&
    checks.signature_valid &&
    checks.issuer_matches;

  let fresh: boolean | null = null;
  if (att.expires_at && opts?.now) {
    const exp = Date.parse(att.expires_at);
    const now = Date.parse(opts.now);
    // Fail closed: an unparseable signed expiry reads as STALE, not "unknown".
    // Only an unparseable caller-supplied clock is genuinely undecidable (null).
    fresh = !Number.isFinite(now) ? null : Number.isFinite(exp) ? now < exp : false;
  }
  return { valid, checks, recomputed_score, fresh };
}
