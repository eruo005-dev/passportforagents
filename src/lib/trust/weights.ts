/**
 * Trust-signal weights for the transparent 0–100 trust score.
 *
 * The score is a documented weighted sum of normalized (0..1) signals:
 *   score = 100 * Σ (signal.value * weight[signal.type])
 *
 * These weights are PROVISIONAL for v1 and finalized in the trust-scoring
 * sprint (Sprint 3). They sum to 1.0. `domain_control` dominates because, per
 * the product principles, no proven domain control should yield a high score.
 * Self-asserted, unverified values are stored with value 0 (zero weight in
 * effect) until independently checked.
 */
export const TRUST_WEIGHTS = {
  domain_control: 0.3,
  signed_provenance: 0.2,
  secret_hygiene: 0.2,
  uptime: 0.1,
  registry_presence: 0.1,
  user_rating: 0.1,
} as const;

export type TrustSignalType = keyof typeof TRUST_WEIGHTS;
