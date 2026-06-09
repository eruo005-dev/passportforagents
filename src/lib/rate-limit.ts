/**
 * Lightweight in-memory token-bucket rate limiter.
 *
 * Per-instance (no Redis/KV dependency) — it caps burst abuse on each
 * serverless instance, which together with CDN caching on cacheable responses
 * meaningfully blunts DoS / cost-amplification on public, keyless endpoints.
 * For multi-instance hard limits, swap the Map for Upstash/KV later.
 */
type Bucket = { tokens: number; updated: number };

const buckets = new Map<string, Bucket>();
const MAX_KEYS = 10_000;

export type RateLimitResult = { ok: boolean; retryAfter: number; remaining: number };

export function rateLimit(
  key: string,
  limit = 30,
  windowMs = 60_000,
): RateLimitResult {
  const now = Date.now();
  const refillPerMs = limit / windowMs;

  // Bound memory: if the map gets large, drop fully-refilled (idle) buckets.
  if (buckets.size > MAX_KEYS) {
    for (const [k, b] of buckets) {
      if (b.tokens >= limit) buckets.delete(k);
    }
  }

  let b = buckets.get(key);
  if (!b) {
    b = { tokens: limit, updated: now };
    buckets.set(key, b);
  } else {
    b.tokens = Math.min(limit, b.tokens + (now - b.updated) * refillPerMs);
    b.updated = now;
  }

  if (b.tokens >= 1) {
    b.tokens -= 1;
    return { ok: true, retryAfter: 0, remaining: Math.floor(b.tokens) };
  }
  const retryAfter = Math.ceil((1 - b.tokens) / refillPerMs / 1000);
  return { ok: false, retryAfter, remaining: 0 };
}

/** Best-effort client IP from proxy headers (Vercel sets x-forwarded-for). */
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}
