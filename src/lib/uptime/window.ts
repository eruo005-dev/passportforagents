/**
 * Rolling uptime window. Pure + testable. The normalized `uptime` trust signal
 * is the fraction of recent health-probes that succeeded.
 */
export type UptimeSample = { at: string; up: boolean };

export const MAX_SAMPLES = 20;

/** Append a probe result, keeping only the most recent MAX_SAMPLES. */
export function pushSample(
  prev: UptimeSample[],
  up: boolean,
  at: string,
  max = MAX_SAMPLES,
): UptimeSample[] {
  return [...prev, { at, up }].slice(-max);
}

/** Normalized 0..1 uptime = successful probes / total probes. */
export function uptimeValue(samples: UptimeSample[]): number {
  if (samples.length === 0) return 0;
  return samples.filter((s) => s.up).length / samples.length;
}
