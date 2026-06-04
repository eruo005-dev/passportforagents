/**
 * Transparent trust score.
 *
 *   score = round( 100 * Σ over signal types ( value[type] * weight[type] ) )
 *
 * - `value` is the normalized 0..1 signal (1 = best, 0 = worst/absent).
 * - `weight` comes from the canonical TRUST_WEIGHTS (NOT the stored row weight),
 *   so the documented formula is the single source of truth and code/doc can't
 *   drift (enforced by a test).
 * - Absent signals contribute 0. A self-asserted, unverified claim is stored
 *   with value 0, so it can never inflate the score.
 *
 * This is deliberately a plain, auditable weighted sum — never a black box.
 * Full formula + rationale: docs/trust-score.md.
 */
import { TRUST_WEIGHTS, type TrustSignalType } from "./weights";

export type ScoreInput = { signalType: TrustSignalType; value: number };

export type ScoreBreakdownRow = {
  signalType: TrustSignalType;
  value: number;
  weight: number;
  contribution: number; // value * weight, 0..weight
};

export type TrustScore = {
  score: number; // 0..100, integer
  breakdown: ScoreBreakdownRow[];
};

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

/**
 * Compute the 0–100 trust score from a set of signals. Pure and deterministic.
 * If multiple signals share a type, the LAST one wins (the service stores one
 * row per type, but we dedupe defensively).
 */
export function computeTrustScore(signals: ScoreInput[]): TrustScore {
  const latest = new Map<TrustSignalType, number>();
  for (const s of signals) {
    if (s.signalType in TRUST_WEIGHTS) latest.set(s.signalType, clamp01(s.value));
  }

  const breakdown: ScoreBreakdownRow[] = (
    Object.keys(TRUST_WEIGHTS) as TrustSignalType[]
  ).map((signalType) => {
    const weight = TRUST_WEIGHTS[signalType];
    const value = latest.get(signalType) ?? 0;
    return { signalType, value, weight, contribution: value * weight };
  });

  const raw = breakdown.reduce((sum, r) => sum + r.contribution, 0);
  const score = Math.max(0, Math.min(100, Math.round(100 * raw)));
  return { score, breakdown };
}
