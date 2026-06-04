/**
 * Serialize a JSON-LD object for safe inline `<script type="application/ld+json">`
 * injection. `JSON.stringify` does NOT escape `<`, `>`, or `&`, so a string
 * containing `</script>` (e.g. from untrusted upstream registry data) would
 * break out of the script block — a stored-XSS sink. Escaping these three to
 * unicode keeps the JSON valid while making `</script>` breakout impossible.
 * (The block is `application/ld+json` — parsed as data, not executed — so the
 * JS line-separator chars are not a concern here.)
 */
export function jsonLdScript(obj: unknown): string {
  return JSON.stringify(obj).replace(
    /[<>&]/g,
    (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"),
  );
}
