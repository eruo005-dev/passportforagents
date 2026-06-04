import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, sign as nodeSign } from "node:crypto";
import { a2aSigningPayload, verifyA2ACard, type A2AAgentCard } from "../src/lib/a2a/card";

const b64url = (b: Buffer | Uint8Array) =>
  Buffer.from(b).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

// Generate an ES256 (P-256) key and produce a signed A2A card, exactly as a
// spec-compliant A2A server would: JWS detached over JCS(card minus signatures).
function makeSignedCard(overrides: Partial<A2AAgentCard> = {}) {
  const { publicKey, privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
  const jwk = { ...publicKey.export({ format: "jwk" }), kid: "key-1" } as JsonWebKey & { kid: string };

  const card: A2AAgentCard = {
    name: "Example A2A Agent",
    description: "demo",
    version: "1.2.0",
    provider: { url: "https://example.com", organization: "Example Inc" },
    skills: [{ id: "summarize", name: "Summarize" }],
    capabilities: { streaming: false },
    supportedInterfaces: [{ url: "https://example.com/a2a" }],
    ...overrides,
  };

  const payload = a2aSigningPayload(card);
  const protectedHeader = { alg: "ES256", kid: "key-1", jku: "https://example.com/jwks.json", typ: "JOSE" };
  const protectedB64 = b64url(Buffer.from(JSON.stringify(protectedHeader)));
  const signingInput = Buffer.from(`${protectedB64}.${b64url(payload)}`, "ascii");
  const signature = nodeSign("sha256", signingInput, { key: privateKey, dsaEncoding: "ieee-p1363" });

  card.signatures = [{ protected: protectedB64, signature: b64url(signature) }];
  const resolveJwk = async (h: { kid?: string }) => (h.kid === "key-1" ? jwk : null);
  return { card, resolveJwk };
}

test("a2a: validly-signed card served from its own host → VALID", async () => {
  const { card, resolveJwk } = makeSignedCard();
  const r = await verifyA2ACard(card, "example.com", resolveJwk);
  assert.equal(r.valid, true);
  assert.equal(r.checks.signature_valid, true);
  assert.equal(r.checks.domain_binding, true);
  assert.equal(r.keyHost, "example.com");
});

test("a2a: tampered card (field changed after signing) → signature FAILS", async () => {
  const { card, resolveJwk } = makeSignedCard();
  card.name = "Evil Agent"; // mutate a signed field after signing
  const r = await verifyA2ACard(card, "example.com", resolveJwk);
  assert.equal(r.checks.signature_valid, false);
  assert.equal(r.valid, false);
});

test("a2a: valid signature but wrong serving host → domain binding fails", async () => {
  const { card, resolveJwk } = makeSignedCard();
  const r = await verifyA2ACard(card, "evil.com", resolveJwk);
  assert.equal(r.checks.signature_valid, true);
  assert.equal(r.checks.domain_binding, false);
  assert.equal(r.valid, false);
});

test("a2a: unsigned card → not valid, clear error", async () => {
  const card: A2AAgentCard = { name: "No Sig", version: "1.0.0" };
  const r = await verifyA2ACard(card, "example.com", async () => null);
  assert.equal(r.checks.has_signature, false);
  assert.equal(r.valid, false);
  assert.match(r.error ?? "", /not signed/);
});

test("a2a: unresolvable key → not valid", async () => {
  const { card } = makeSignedCard();
  const r = await verifyA2ACard(card, "example.com", async () => null); // resolver returns no key
  assert.equal(r.checks.key_resolved, false);
  assert.equal(r.valid, false);
});

test("a2a: signature-only mode (host=null) passes for a valid card", async () => {
  const { card, resolveJwk } = makeSignedCard();
  const r = await verifyA2ACard(card, null, resolveJwk);
  assert.equal(r.valid, true);
  assert.equal(r.checks.domain_binding, true); // skipped
});
