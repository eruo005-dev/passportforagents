/**
 * RFC 8785 JSON Canonicalization Scheme (JCS).
 *
 * We canonicalize the passport body BEFORE signing/verifying so that two
 * semantically-identical JSON documents always produce the same bytes (and
 * therefore the same signature). This is the SSL/DKIM-style trust primitive at
 * the heart of AgentPassport — see SPEC.md.
 *
 * Implementation notes (kept dependency-free on purpose):
 *  - Object members are sorted by their key's UTF-16 code units, which is
 *    exactly what the default ECMAScript string sort does (RFC 8785 §3.2.3).
 *  - Strings are serialized with standard JSON escaping (RFC 8785 §3.2.2.2),
 *    which matches `JSON.stringify` of a string.
 *  - Numbers use the ECMAScript Number-to-String form via `JSON.stringify`
 *    (RFC 8785 §3.2.2.3 is defined in terms of the same ECMAScript algorithm).
 *  - `undefined` members are dropped (they are not valid JSON).
 *
 * The documents we sign (passport bodies) contain only strings, string arrays,
 * and booleans — no floating-point numbers — so the number edge cases that
 * motivate a heavyweight library do not apply here.
 */

function serialize(value: unknown): string {
  if (value === null) return "null";

  const t = typeof value;
  if (t === "number") {
    if (!Number.isFinite(value as number)) {
      throw new Error("JCS: non-finite numbers are not allowed");
    }
    return JSON.stringify(value);
  }
  if (t === "boolean" || t === "string") {
    return JSON.stringify(value);
  }
  if (t === "bigint") {
    throw new Error("JCS: bigint is not serializable to JSON");
  }

  if (Array.isArray(value)) {
    return "[" + value.map((v) => serialize(v === undefined ? null : v)).join(",") + "]";
  }

  if (t === "object") {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj)
      .filter((k) => obj[k] !== undefined)
      .sort(); // UTF-16 code-unit order
    const members = keys.map(
      (k) => JSON.stringify(k) + ":" + serialize(obj[k]),
    );
    return "{" + members.join(",") + "}";
  }

  throw new Error(`JCS: cannot serialize value of type ${t}`);
}

/** Canonicalize an arbitrary JSON value to its RFC 8785 string form. */
export function jcsCanonicalize(value: unknown): string {
  return serialize(value);
}

/** Canonicalize and return UTF-8 bytes, ready to feed to Ed25519. */
export function jcsCanonicalizeBytes(value: unknown): Uint8Array {
  return new TextEncoder().encode(serialize(value));
}
