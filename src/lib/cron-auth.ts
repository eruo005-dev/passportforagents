import "server-only";
import { timingSafeEqual } from "node:crypto";

/**
 * Constant-time check that a request carries the correct Vercel-Cron bearer.
 * Fail-closed when CRON_SECRET is unset. Timing-safe to avoid leaking the secret
 * via response-time differences.
 */
export function cronAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const provided = Buffer.from(req.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}
