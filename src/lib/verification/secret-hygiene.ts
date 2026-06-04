/**
 * MCP secret-hygiene scan — "light active probing" (human-authorized 2026-06-04).
 *
 * Hard constraints (enforced here + at the call site):
 *  - Runs ONLY against a domain an owner has CLAIMED. The persistence wrapper
 *    (`runSecretHygieneScan`) derives the domain from the agent record, so an
 *    arbitrary/unclaimed domain can never be passed in.
 *  - Probes a SMALL FIXED allowlist of well-known paths. The list is a module
 *    constant; callers cannot expand it.
 *  - Gentle: probes are SEQUENTIAL with a delay between them, via the
 *    SSRF-hardened `safeFetch` (HTTPS-only, IP-pinned, redirect-refused, capped).
 *  - We record a finding (path + redacted reason) — NEVER the secret value.
 *
 * Output feeds the `secret_hygiene` trust signal: clean = 1, exposed = 0.
 */

/** Fixed allowlist — NOT caller-expandable. */
export const PROBE_PATHS = [
  "/.env",
  "/.env.local",
  "/.git/config",
  "/config.json",
] as const;

const PROBE_DELAY_MS = 250;

const SECRET_PATTERNS: { re: RegExp; reason: string }[] = [
  { re: /(?:^|\n)\s*[A-Z0-9_]*(?:KEY|SECRET|TOKEN|PASSWORD|PASSWD|PWD|CREDENTIAL)\s*=/i, reason: "secret-shaped env assignment" },
  { re: /AKIA[0-9A-Z]{16}/, reason: "AWS access key id" },
  { re: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/, reason: "private key block" },
  { re: /sk_(?:live|test)_[0-9a-zA-Z]{8,}/, reason: "stripe-style secret key" },
];

/** Decide if a fetched body at `path` indicates an exposed secret. No value stored. */
export function looksSecret(path: string, body: string): string | null {
  if (path === "/.git/config") {
    return /\[core\]|\[remote /.test(body) ? "exposed .git directory" : null;
  }
  for (const { re, reason } of SECRET_PATTERNS) {
    if (re.test(body)) return reason;
  }
  return null;
}

export type HygieneFinding = { path: string; reason: string };
export type HygieneResult = {
  exposed: boolean;
  checked: string[];
  findings: HygieneFinding[];
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Probe the fixed allowlist on `domain`. Sequential + throttled. Returns
 * findings (no secret values). `fetchImpl` is injectable for tests; production
 * uses the SSRF-hardened safeFetch.
 */
export async function scanSecretHygiene(
  domain: string,
  fetchImpl: (input: string, init?: RequestInit) => Promise<Response>,
  opts: { delayMs?: number } = {},
): Promise<HygieneResult> {
  const delay = opts.delayMs ?? PROBE_DELAY_MS;
  const checked: string[] = [];
  const findings: HygieneFinding[] = [];

  for (let i = 0; i < PROBE_PATHS.length; i++) {
    const path = PROBE_PATHS[i];
    const target = `https://${domain}${path}`;
    checked.push(path);
    try {
      const res = await fetchImpl(target);
      if (res.ok) {
        const body = (await res.text()).slice(0, 16 * 1024);
        const reason = looksSecret(path, body);
        if (reason) findings.push({ path, reason });
      }
    } catch {
      // Unreachable path / blocked / non-2xx → not a finding. Hygiene is good.
    }
    if (i < PROBE_PATHS.length - 1 && delay > 0) await sleep(delay); // gentle
  }

  return { exposed: findings.length > 0, checked, findings };
}
