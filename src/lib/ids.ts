import { randomBytes } from "node:crypto";

/** Crockford base32 (no I/L/O/U) — case-insensitive, URL-safe, unambiguous. */
const B32 = "0123456789abcdefghjkmnpqrstvwxyz";

function base32(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export const AGENT_ID_PREFIX = "agt_";
export const AGENT_ID_RE = /^agt_[0-9a-hjkmnp-tv-z]{10,}$/;

/** Stable public Agent ID, e.g. "agt_9f3k2...". ~64 bits of entropy. */
export function generateAgentPublicId(): string {
  return AGENT_ID_PREFIX + base32(randomBytes(8));
}

export function isAgentPublicId(s: string): boolean {
  return AGENT_ID_RE.test(s.trim());
}
