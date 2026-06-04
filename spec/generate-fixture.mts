#!/usr/bin/env -S npx tsx
/**
 * Generate a hand-crafted, signed agent-passport.json fixture (and its keypair)
 * for testing the reference verifier. Writes to spec/fixtures/.
 *
 * Usage: npx tsx spec/generate-fixture.ts
 */
import { mkdir, writeFile } from "node:fs/promises";
import { bytesToHex } from "@noble/hashes/utils.js";
import { generateKeyPair } from "../src/lib/crypto/ed25519";
import { encodePublicKey } from "../src/lib/crypto/multibase";
import { signPassport } from "../src/lib/passport/core";
import { SPEC_VERSION, type PassportForAgentsBody } from "../src/lib/passport/types";

async function main() {
  const dir = "spec/fixtures";
  await mkdir(dir, { recursive: true });

  const { secretKey, publicKey } = generateKeyPair();

  const body: PassportForAgentsBody = {
    spec_version: SPEC_VERSION,
    agent_name: "Example MCP Server",
    agent_type: "mcp_server",
    owner_domain: "example.com",
    public_key: encodePublicKey(publicKey),
    capabilities: ["tools/list", "tools/call", "resources/read"],
    homepage: "https://example.com",
    repo: "https://github.com/example/mcp-server",
    // Fixed timestamp so the fixture is deterministic / reproducible.
    issued_at: "2026-06-04T00:00:00Z",
  };

  const passport = signPassport(body, secretKey);

  await writeFile(
    `${dir}/agent-passport.json`,
    JSON.stringify(passport, null, 2) + "\n",
  );
  // Tampered copy: flip the agent_name AFTER signing → signature must fail.
  await writeFile(
    `${dir}/agent-passport.tampered.json`,
    JSON.stringify({ ...passport, agent_name: "Evil MCP Server" }, null, 2) + "\n",
  );
  // Save the secret seed so the fixture can be regenerated / re-signed.
  await writeFile(
    `${dir}/keypair.json`,
    JSON.stringify(
      {
        note: "TEST KEY ONLY — do not use in production.",
        secret_key_hex: bytesToHex(secretKey),
        public_key_multibase: encodePublicKey(publicKey),
      },
      null,
      2,
    ) + "\n",
  );

  console.log("Wrote:");
  console.log(`  ${dir}/agent-passport.json          (valid, signed)`);
  console.log(`  ${dir}/agent-passport.tampered.json (signature should FAIL)`);
  console.log(`  ${dir}/keypair.json                  (test key)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
