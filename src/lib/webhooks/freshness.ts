/**
 * Freshness evaluation for verification expiry. Pure + testable.
 *
 * An agent's verification is "stale" once now is past its latest successful
 * verification's `expiresAt`. Webhooks fire only when this label CHANGES vs the
 * last-known `agents.freshness_state`.
 */

export type FreshnessLabel = "fresh" | "stale";

/** Stale iff there is an expiry and we are past it. */
export function computeStale(expiresAt: Date | null, now: Date): boolean {
  if (!expiresAt) return false;
  return now.getTime() > expiresAt.getTime();
}

export function freshnessLabel(stale: boolean): FreshnessLabel {
  return stale ? "stale" : "fresh";
}

/**
 * Decide the current label, whether to PERSIST it, and whether to FIRE a webhook.
 * `previous` is `agents.freshness_state` (null on first evaluation).
 *
 * Fire on any real transition (fresh↔stale), and on a first-ever evaluation that
 * is already stale — but NOT on the initial healthy (fresh) state, so the first
 * cron sweep doesn't spam receivers with spurious "fresh" events.
 */
export function evaluateFreshness(
  previous: string | null,
  expiresAt: Date | null,
  now: Date,
): { current: FreshnessLabel; changed: boolean } {
  const current = freshnessLabel(computeStale(expiresAt, now));
  const changed = previous === null ? current === "stale" : previous !== current;
  return { current, changed };
}
