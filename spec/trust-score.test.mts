import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { computeTrustScore } from "../src/lib/trust/score";
import { TRUST_WEIGHTS, type TrustSignalType } from "../src/lib/trust/weights";

const types = Object.keys(TRUST_WEIGHTS) as TrustSignalType[];

test("weights sum to exactly 1.0", () => {
  const sum = types.reduce((s, t) => s + TRUST_WEIGHTS[t], 0);
  assert.ok(Math.abs(sum - 1) < 1e-9, `weights sum to ${sum}`);
});

test("no signals → score 0", () => {
  const { score, breakdown } = computeTrustScore([]);
  assert.equal(score, 0);
  assert.equal(breakdown.length, types.length);
  assert.ok(breakdown.every((r) => r.contribution === 0));
});

test("all signals at value 1 → score 100", () => {
  const { score } = computeTrustScore(types.map((t) => ({ signalType: t, value: 1 })));
  assert.equal(score, 100);
});

test("partial signals score by their weights (domain_control=1 → 30)", () => {
  const { score, breakdown } = computeTrustScore([
    { signalType: "domain_control", value: 1 },
  ]);
  assert.equal(score, Math.round(100 * TRUST_WEIGHTS.domain_control));
  const dc = breakdown.find((r) => r.signalType === "domain_control");
  assert.equal(dc?.contribution, TRUST_WEIGHTS.domain_control);
});

test("exposed secret (secret_hygiene=0) scores lower than a clean scan (=1)", () => {
  const base: { signalType: TrustSignalType; value: number }[] = [
    { signalType: "domain_control", value: 1 },
  ];
  const clean = computeTrustScore([...base, { signalType: "secret_hygiene", value: 1 }]).score;
  const exposed = computeTrustScore([...base, { signalType: "secret_hygiene", value: 0 }]).score;
  assert.ok(clean > exposed, `clean ${clean} should exceed exposed ${exposed}`);
});

test("values are clamped to [0,1]", () => {
  const { score } = computeTrustScore(types.map((t) => ({ signalType: t, value: 5 })));
  assert.equal(score, 100); // clamped, not 500
});

// Doc ↔ code: the weight table in docs/trust-score.md must equal TRUST_WEIGHTS.
test("documented weights match TRUST_WEIGHTS (no drift)", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const doc = readFileSync(join(here, "..", "docs", "trust-score.md"), "utf8");
  const documented: Record<string, number> = {};
  const rowRe = /\|\s*`(\w+)`\s*\|\s*([0-9.]+)\s*\|/g;
  let m: RegExpExecArray | null;
  while ((m = rowRe.exec(doc)) !== null) {
    if (m[1] in TRUST_WEIGHTS) documented[m[1]] = Number(m[2]);
  }
  assert.deepEqual(
    documented,
    Object.fromEntries(types.map((t) => [t, TRUST_WEIGHTS[t]])),
    "docs/trust-score.md weight table drifted from TRUST_WEIGHTS",
  );
});
