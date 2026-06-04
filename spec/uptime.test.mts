import { test } from "node:test";
import assert from "node:assert/strict";
import { pushSample, uptimeValue, MAX_SAMPLES } from "../src/lib/uptime/window";
import { cronAuthorized } from "../src/lib/cron-auth";

test("uptime window: rolling cap + value = ups/total", () => {
  let s: ReturnType<typeof pushSample> = [];
  for (let i = 0; i < MAX_SAMPLES + 5; i++) s = pushSample(s, i % 2 === 0, `t${i}`);
  assert.equal(s.length, MAX_SAMPLES, "window capped");
  assert.equal(uptimeValue([]), 0);
  assert.equal(uptimeValue([{ at: "a", up: true }, { at: "b", up: true }]), 1);
  assert.equal(uptimeValue([{ at: "a", up: true }, { at: "b", up: false }]), 0.5);
});

test("cronAuthorized: fail-closed, constant-time bearer", () => {
  const prev = process.env.CRON_SECRET;
  try {
    process.env.CRON_SECRET = "";
    assert.equal(cronAuthorized(new Request("http://x", { headers: { authorization: "Bearer s" } })), false);
    process.env.CRON_SECRET = "topsecret";
    assert.equal(cronAuthorized(new Request("http://x")), false); // no header
    assert.equal(cronAuthorized(new Request("http://x", { headers: { authorization: "Bearer wrong" } })), false);
    assert.equal(cronAuthorized(new Request("http://x", { headers: { authorization: "Bearer topsecret" } })), true);
  } finally {
    if (prev === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = prev;
  }
});
