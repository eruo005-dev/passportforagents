/**
 * Webhook HMAC signing (Stripe-style). The signature header is
 *   `t=<unix_ts>,v1=<hex hmac-sha256 of "<t>.<payload>">`
 * Receivers recompute the HMAC with their shared secret to verify authenticity
 * + integrity, and check `t` to reject replays. Pure + unit-testable.
 */
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const SIGNATURE_HEADER = "x-passportforagents-signature";

export function generateWebhookSecret(): string {
  return "whsec_" + randomBytes(24).toString("hex");
}

/** Compute the signature header value for a payload at a given unix timestamp (seconds). */
export function signPayload(secret: string, payload: string, timestampSec: number): string {
  const mac = createHmac("sha256", secret)
    .update(`${timestampSec}.${payload}`)
    .digest("hex");
  return `t=${timestampSec},v1=${mac}`;
}

/** Verify a signature header against a payload + secret (constant-time). */
export function verifySignature(secret: string, payload: string, header: string): boolean {
  const parts = Object.fromEntries(
    header.split(",").map((kv) => {
      const i = kv.indexOf("=");
      return [kv.slice(0, i).trim(), kv.slice(i + 1).trim()];
    }),
  );
  const t = Number(parts.t);
  const v1 = parts.v1;
  if (!Number.isFinite(t) || !v1) return false;
  const expected = createHmac("sha256", secret).update(`${t}.${payload}`).digest("hex");
  try {
    const a = Buffer.from(v1, "hex");
    const b = Buffer.from(expected, "hex");
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
