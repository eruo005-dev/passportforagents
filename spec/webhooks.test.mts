import { test } from "node:test";
import assert from "node:assert/strict";
import { generateWebhookSecret, signPayload, verifySignature } from "../src/lib/webhooks/sign";
import { computeStale, evaluateFreshness, freshnessLabel } from "../src/lib/webhooks/freshness";

// ── signing ─────────────────────────────────────────────────────────────────

test("webhook sign: round-trips and rejects tampering", () => {
  const secret = generateWebhookSecret();
  assert.match(secret, /^whsec_[0-9a-f]{48}$/);
  const payload = JSON.stringify({ type: "agent.freshness_changed", state: "stale" });
  const header = signPayload(secret, payload, 1780000000);
  assert.match(header, /^t=1780000000,v1=[0-9a-f]{64}$/);

  assert.equal(verifySignature(secret, payload, header), true);
  assert.equal(verifySignature(secret, payload + "x", header), false); // tampered payload
  assert.equal(verifySignature("whsec_wrong", payload, header), false); // wrong secret
  assert.equal(verifySignature(secret, payload, "t=1,v1=deadbeef"), false); // bad sig
});

// ── freshness ─────────────────────────────────────────────────────────────--

const now = new Date("2026-06-04T12:00:00Z");

test("computeStale: null expiry never stale; past=stale; future=fresh", () => {
  assert.equal(computeStale(null, now), false);
  assert.equal(computeStale(new Date("2026-06-03T12:00:00Z"), now), true);
  assert.equal(computeStale(new Date("2026-07-04T12:00:00Z"), now), false);
  assert.equal(freshnessLabel(true), "stale");
  assert.equal(freshnessLabel(false), "fresh");
});

test("evaluateFreshness: change detection vs stored state", () => {
  const past = new Date("2026-06-01T00:00:00Z");
  const future = new Date("2026-09-01T00:00:00Z");

  // first evaluation: initial healthy state does NOT fire (avoids cron spam);
  // first-ever-stale DOES fire.
  assert.deepEqual(evaluateFreshness(null, future, now), { current: "fresh", changed: false });
  assert.deepEqual(evaluateFreshness(null, past, now), { current: "stale", changed: true });

  // no change when stored == current
  assert.deepEqual(evaluateFreshness("fresh", future, now), { current: "fresh", changed: false });
  assert.deepEqual(evaluateFreshness("stale", past, now), { current: "stale", changed: false });

  // flip
  assert.deepEqual(evaluateFreshness("fresh", past, now), { current: "stale", changed: true });
  assert.deepEqual(evaluateFreshness("stale", future, now), { current: "fresh", changed: true });
});
