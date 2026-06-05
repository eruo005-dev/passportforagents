import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { generateKeyPair } from "../src/lib/crypto/ed25519";
import { encodePublicKey } from "../src/lib/crypto/multibase";
import { signPassport, verifyPassport, verifyListedAgent } from "../src/lib/passport/core";
import { SPEC_VERSION, type PassportForAgentsBody, type PassportForAgents } from "../src/lib/passport/types";
import { generateAgentPublicId, isAgentPublicId, AGENT_ID_RE } from "../src/lib/ids";

function signedDomainDoc(): PassportForAgents {
  const { secretKey, publicKey } = generateKeyPair();
  const body: PassportForAgentsBody = {
    spec_version: SPEC_VERSION,
    agent_name: "AgoraMind",
    agent_type: "a2a_agent",
    owner_domain: "agoramind.ai",
    public_key: encodePublicKey(publicKey),
    capabilities: ["debate"],
    agents: [
      { id: "the_ethicist", name: "The Ethicist", capabilities: ["debate"] },
      { id: "the_provocateur", name: "The Provocateur", capabilities: ["debate"] },
    ],
    issued_at: "2026-06-05T00:00:00Z",
  };
  return signPassport(body, secretKey);
}

// ── Agent IDs ───────────────────────────────────────────────────────────────

test("agt_ id: generated ids match the public format + detector", () => {
  for (let i = 0; i < 50; i++) {
    const id = generateAgentPublicId();
    assert.match(id, AGENT_ID_RE);
    assert.equal(isAgentPublicId(id), true);
  }
  assert.equal(isAgentPublicId("not-an-id"), false);
  assert.equal(isAgentPublicId("agt_SHORT"), false); // uppercase / too short
  assert.equal(isAgentPublicId("example.com"), false);
});

// ── Signed agents[] → per-agent identity (the headline) ─────────────────────

test("signed agents[]: each listed sub-agent is identity-verified by the domain key", () => {
  const doc = signedDomainDoc();
  const r = verifyPassport(doc, "agoramind.ai");
  assert.equal(r.valid, true);
  assert.equal(r.listedAgents?.length, 2);
  assert.equal(verifyListedAgent(doc, "the_ethicist"), true);
  assert.equal(verifyListedAgent(doc, "the_provocateur"), true);
  assert.equal(verifyListedAgent(doc, "an_unlisted_agent"), false);
});

test("TAMPERED agents[]: any mutation breaks the single signature → ALL sub-agents fail", () => {
  const doc = signedDomainDoc();
  // Flip a listed sub-agent's name AFTER signing.
  doc.agents![0].name = "Impersonator";
  const r = verifyPassport(doc, "agoramind.ai");
  assert.equal(r.checks.signature_valid, false);
  assert.equal(r.valid, false);
  assert.equal(r.listedAgents, undefined); // never expose unsigned sub-agents
  assert.equal(verifyListedAgent(doc, "the_ethicist"), false);
  assert.equal(verifyListedAgent(doc, "the_provocateur"), false);
});

test("INJECTED agents[]: appending an unlisted agent after signing fails closed", () => {
  const doc = signedDomainDoc();
  doc.agents!.push({ id: "smuggled", name: "Smuggled", capabilities: [] });
  assert.equal(verifyListedAgent(doc, "smuggled"), false);
  assert.equal(verifyPassport(doc, "agoramind.ai").valid, false);
});

// ── Backward compatibility (spec 0.1.0) ─────────────────────────────────────

test("backward-compat: a 0.1.0 passport (no agents[]) still verifies; listedAgents empty", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const doc = JSON.parse(readFileSync(join(here, "fixtures", "agent-passport.json"), "utf8")) as PassportForAgents;
  assert.equal(doc.spec_version, "0.1.0");
  const r = verifyPassport(doc, "example.com");
  assert.equal(r.valid, true);
  assert.deepEqual(r.listedAgents, []); // signature valid, simply no sub-agents
});
