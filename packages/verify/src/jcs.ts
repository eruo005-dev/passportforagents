/**
 * RFC 8785 JSON Canonicalization Scheme (JCS) — inlined (zero-dep). Must produce
 * byte-identical output to the issuer's canonicalization, or signatures fail.
 */
function serialize(value: unknown): string {
  if (value === null) return "null";
  const t = typeof value;
  if (t === "number") {
    if (!Number.isFinite(value as number)) throw new Error("JCS: non-finite number");
    return JSON.stringify(value);
  }
  if (t === "boolean" || t === "string") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return "[" + value.map((v) => serialize(v === undefined ? null : v)).join(",") + "]";
  }
  if (t === "object") {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj)
      .filter((k) => obj[k] !== undefined)
      .sort();
    return "{" + keys.map((k) => JSON.stringify(k) + ":" + serialize(obj[k])).join(",") + "}";
  }
  throw new Error(`JCS: cannot serialize ${t}`);
}

export function jcsBytes(value: unknown): Uint8Array {
  return new TextEncoder().encode(serialize(value));
}
