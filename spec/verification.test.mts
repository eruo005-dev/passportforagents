import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { fetchAndVerify, verifyPassport } from "../src/lib/passport/core";
import type { AgentPassport } from "../src/lib/passport/types";
import { checkDnsChallenge, expectedTxtRecord, matchesChallenge } from "../src/lib/verification/dns";
import { readCapped } from "../src/lib/verification/safe-fetch";
import { renderBadgeSvg, BADGE_CACHE_CONTROL } from "../src/lib/badge";

// Build a Response whose body streams `chunks` with NO content-length (chunked).
function streamingResponse(chunks: Uint8Array[]): Response {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const c of chunks) controller.enqueue(c);
      controller.close();
    },
  });
  return new Response(stream, { status: 200 });
}

const here = dirname(fileURLToPath(import.meta.url));
const readFixture = (name: string): AgentPassport =>
  JSON.parse(readFileSync(join(here, "fixtures", name), "utf8"));

const valid = readFixture("agent-passport.json");
const tampered = readFixture("agent-passport.tampered.json");

// A mock fetch that always serves `doc` as a 200 JSON response.
const mockFetch =
  (doc: unknown): typeof fetch =>
  async () =>
    new Response(JSON.stringify(doc), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

// ── .well-known / signature path ────────────────────────────────────────────

test("well-known: valid passport served from its own domain → VALID", async () => {
  const r = await fetchAndVerify("example.com", mockFetch(valid));
  assert.equal(r.valid, true);
  assert.equal(r.checks.signature_valid, true);
  assert.equal(r.checks.domain_matches, true);
  assert.equal(r.document?.owner_domain, "example.com");
});

test("well-known: tampered body → signature FAILS, not valid", async () => {
  const r = await fetchAndVerify("example.com", mockFetch(tampered));
  assert.equal(r.checks.signature_valid, false);
  assert.equal(r.valid, false);
});

test("well-known: valid passport served from the WRONG host → domain mismatch", async () => {
  // Signature is fine, but the serving host (evil.com) != owner_domain (example.com).
  const r = await fetchAndVerify("evil.com", mockFetch(valid));
  assert.equal(r.checks.signature_valid, true);
  assert.equal(r.checks.domain_matches, false);
  assert.equal(r.valid, false);
});

test("verifyPassport: signature-only mode (host=null) passes for a valid doc", () => {
  const r = verifyPassport(valid, null);
  assert.equal(r.checks.signature_valid, true);
  assert.equal(r.checks.domain_matches, true); // skipped
  assert.equal(r.valid, true);
});

// ── DNS TXT path ──────────────────────────────────────────────────────────--

test("dns: matching TXT record → matched", async () => {
  const token = "abc123";
  const resolver = async () => [[expectedTxtRecord(token)], ["unrelated=foo"]];
  const r = await checkDnsChallenge("example.com", token, resolver);
  assert.equal(r.matched, true);
});

test("dns: missing/wrong TXT record → not matched", async () => {
  const resolver = async () => [["some-other-record=1"], ["v=spf1 -all"]];
  const r = await checkDnsChallenge("example.com", "abc123", resolver);
  assert.equal(r.matched, false);
});

test("dns: matchesChallenge is exact (no partial/substring match)", () => {
  const token = "tok";
  assert.equal(matchesChallenge([expectedTxtRecord(token)], token), true);
  assert.equal(matchesChallenge([`x${expectedTxtRecord(token)}`], token), false);
  assert.equal(matchesChallenge([], token), false);
});

// ── SSRF safe-fetch body cap (streamed bytes, not the content-length header) ─

test("safe-fetch: readCapped accepts a body at the limit", async () => {
  const max = 64 * 1024;
  const bytes = await readCapped(streamingResponse([new Uint8Array(max)]), max);
  assert.equal(bytes.byteLength, max);
});

test("safe-fetch: readCapped rejects an oversized chunked body (no content-length)", async () => {
  const max = 64 * 1024;
  // Two 40KB chunks = 80KB > cap, with no content-length to pre-screen on.
  const chunks = [new Uint8Array(40 * 1024), new Uint8Array(40 * 1024)];
  await assert.rejects(
    () => readCapped(streamingResponse(chunks), max),
    /too large/,
  );
});

// ── embeddable badge ─────────────────────────────────────────────────────---

test("badge: key_verified shows status + score in a valid SVG", () => {
  const svg = renderBadgeSvg({ status: "key_verified", score: 50 });
  assert.match(svg, /^<svg[\s>]/);
  assert.match(svg, /key-verified/);
  assert.match(svg, /50/);
  assert.match(svg, /role="img"/);
});

test("badge: unverified/suspended omit a score number", () => {
  const svg = renderBadgeSvg({ status: "unverified", score: 0 });
  assert.match(svg, /unverified/);
  // No " · <score>" segment for unverified.
  assert.doesNotMatch(svg, /·/);
});

test("badge: cache header is short-TTL public", () => {
  assert.match(BADGE_CACHE_CONTROL, /public/);
  assert.match(BADGE_CACHE_CONTROL, /max-age=300/);
});
