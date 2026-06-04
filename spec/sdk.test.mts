import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  verifyStandalone,
  verifyPassport,
  verifyHosted,
  type AgentPassport,
} from "../packages/verify/src/index";
import { base58decode } from "../packages/verify/src/base58";

test("sdk: base58decode handles leading-zero + empty exactly", () => {
  assert.deepEqual([...base58decode("")], []);
  assert.deepEqual([...base58decode("1")], [0]); // single zero byte
  assert.deepEqual([...base58decode("11")], [0, 0]);
  // round-trip a known value: base58("Z") = 0x20 (32)
  assert.deepEqual([...base58decode("Z")], [32]);
});

const here = dirname(fileURLToPath(import.meta.url));
const read = (n: string): AgentPassport =>
  JSON.parse(readFileSync(join(here, "fixtures", n), "utf8"));
const valid = read("agent-passport.json");
const tampered = read("agent-passport.tampered.json");

const serve = (doc: unknown) => async () =>
  new Response(JSON.stringify(doc), { status: 200, headers: { "content-type": "application/json" } });

// Cross-validation: our @noble-signed fixture must verify under the SDK's
// platform WebCrypto Ed25519 — proving interop of the open wire format.
test("sdk: standalone verify of a valid passport (WebCrypto interop)", async () => {
  const r = await verifyStandalone("example.com", { fetchImpl: serve(valid) });
  assert.equal(r.valid, true);
  assert.equal(r.checks.signature_valid, true);
  assert.equal(r.checks.domain_matches, true);
  assert.equal(r.document?.agent_name, "Example MCP Server");
});

test("sdk: tampered passport → signature fails", async () => {
  const r = await verifyStandalone("example.com", { fetchImpl: serve(tampered) });
  assert.equal(r.checks.signature_valid, false);
  assert.equal(r.valid, false);
});

test("sdk: wrong serving host → domain mismatch", async () => {
  const r = await verifyStandalone("evil.com", { fetchImpl: serve(valid) });
  assert.equal(r.checks.signature_valid, true);
  assert.equal(r.checks.domain_matches, false);
  assert.equal(r.valid, false);
});

test("sdk: signature-only mode (host=null) passes for a valid doc", async () => {
  const r = await verifyPassport(valid, null);
  assert.equal(r.valid, true);
});

test("sdk: hosted verify parses 200 and surfaces 401", async () => {
  const ok = await verifyHosted({
    agent: "acme",
    apiKey: "k",
    fetchImpl: async () =>
      new Response(JSON.stringify({ agent: { slug: "acme", name: "Acme" }, verified: true, trust: { score: 70, breakdown: [] } }), { status: 200 }),
  });
  assert.equal(ok.ok, true);
  assert.equal(ok.verified, true);
  assert.equal(ok.trust?.score, 70);

  const unauth = await verifyHosted({
    agent: "acme",
    apiKey: "bad",
    fetchImpl: async () => new Response(JSON.stringify({ error: "missing or invalid API key" }), { status: 401 }),
  });
  assert.equal(unauth.ok, false);
  assert.equal(unauth.status, 401);
});
