#!/usr/bin/env node
/**
 * Registry drift monitor (PassportForAgents issuer side).
 *
 * Fetches a domain's signed registry (default: AgoraMind) and reports whether
 * the on-file ed25519 attestation needs re-signing. Re-sign is "due" when ANY:
 *   - age of the signature approaches the freshness window (age >= AGE_WARN_DAYS)
 *   - the live roster has drifted past the signed snapshot (drift >= DRIFT_MAX)
 *   - signed-set coverage of the live roster falls below COVERAGE_MIN
 *
 * Exit code 0 = ok, 1 = re-sign due, 2 = fetch/parse error.
 * Pure read-only over public data — touches no keys.
 *
 *   node scripts/check-registry-drift.mjs [--url <agents.json>] [--json]
 */
const arg = (f, d) => {
  const i = process.argv.indexOf(f);
  return i >= 0 ? process.argv[i + 1] : d;
};

const URL = arg("--url", "https://www.agoramind.ai/.well-known/agents.json");
const WINDOW_DAYS = Number(arg("--window", "30"));
const AGE_WARN_DAYS = Number(arg("--age-warn", "25"));
const DRIFT_MAX = Number(arg("--drift-max", "50"));
const COVERAGE_MIN = Number(arg("--coverage-min", "0.95"));
const JSON_ONLY = process.argv.includes("--json");

try {
  const res = await fetch(URL, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`fetch ${URL} -> HTTP ${res.status}`);
  const doc = await res.json();

  const live = doc.count ?? doc.listed ?? doc.agents?.length ?? null;
  const s = doc.signed ?? {};
  const signedCount = s.signed_count ?? null;
  const signedAtMs = s.signed_at ? Date.parse(s.signed_at) : null;
  const ageDays =
    signedAtMs != null ? (Date.now() - signedAtMs) / 864e5 : Infinity;
  const drift = signedCount != null && live != null ? live - signedCount : null;
  const coverage =
    signedCount != null && live ? signedCount / live : null;

  const reasons = [];
  if (!Number.isFinite(ageDays))
    reasons.push("no signed_at on file (cannot age-check)");
  else if (ageDays >= AGE_WARN_DAYS)
    reasons.push(
      `age ${ageDays.toFixed(1)}d >= ${AGE_WARN_DAYS}d (window ${WINDOW_DAYS}d)`,
    );
  if (drift != null && drift >= DRIFT_MAX)
    reasons.push(`drift ${drift} >= ${DRIFT_MAX}`);
  if (coverage != null && coverage < COVERAGE_MIN)
    reasons.push(
      `coverage ${(coverage * 100).toFixed(1)}% < ${COVERAGE_MIN * 100}%`,
    );

  const due = reasons.length > 0;
  const report = {
    checked_url: URL,
    live_count: live,
    signed_count: signedCount,
    drift,
    coverage: coverage != null ? Number(coverage.toFixed(4)) : null,
    age_days: Number.isFinite(ageDays) ? Number(ageDays.toFixed(2)) : null,
    verified: s.verified ?? null,
    fresh: s.fresh ?? null,
    signed_digest: s.digest ?? null,
    resign_due: due,
    reasons,
  };

  if (JSON_ONLY) {
    console.log(JSON.stringify(report, null, 2));
  } else if (due) {
    console.log(
      `⚠️  RE-SIGN DUE for ${URL}\n` +
        `    live=${live} signed=${signedCount} drift=${drift} ` +
        `coverage=${report.coverage} age=${report.age_days}d\n` +
        `    reasons: ${reasons.join("; ")}\n` +
        `    fix: fetch latest roster, then\n` +
        `         npx tsx scripts/sign-registry.mts --roster <agents.json>\n` +
        `         paste the new \`signed\` block into AgoraMind + redeploy.`,
    );
  } else {
    console.log(
      `✓ registry healthy — live=${live} signed=${signedCount} ` +
        `drift=${drift} coverage=${report.coverage} age=${report.age_days}d ` +
        `(verified=${report.verified} fresh=${report.fresh})`,
    );
  }
  process.exitCode = due ? 1 : 0;
} catch (err) {
  console.error(`drift-check error: ${err.message}`);
  process.exitCode = 2;
}

// Don't process.exit() — a forced teardown while undici's keep-alive socket is
// still open triggers a libuv assertion on Windows. Setting exitCode and letting
// the loop drain exits cleanly; nudge it closed so a scheduler isn't kept waiting.
setTimeout(() => process.exit(process.exitCode ?? 0), 1500).unref();
