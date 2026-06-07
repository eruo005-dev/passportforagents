#!/usr/bin/env -S npx tsx
/**
 * Generate PassportForAgents' OWN signed agent-passport.json (dogfood) and write
 * it to public/.well-known/agent-passport.json so we appear verifiable in our
 * own ecosystem. Signed here with a generated DEV key; for production the human
 * regenerates with the real domain key (human-gated). The private key is NOT
 * committed.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { bytesToHex } from "@noble/hashes/utils.js";
import { generateKeyPair } from "../src/lib/crypto/ed25519";
import { encodePublicKey } from "../src/lib/crypto/multibase";
import { signPassport } from "../src/lib/passport/core";
import { SPEC_VERSION, type PassportForAgentsBody } from "../src/lib/passport/types";

const { secretKey, publicKey } = generateKeyPair();
const body: PassportForAgentsBody = {
  spec_version: SPEC_VERSION,
  agent_name: "PassportForAgents",
  agent_type: "mcp_server",
  owner_domain: "passportforagents.com",
  public_key: encodePublicKey(publicKey),
  capabilities: ["verify", "registry", "trust-score"],
  homepage: "https://passportforagents.com",
  repo: "https://github.com/eruo005-dev/passportforagents",
  issued_at: "2026-06-04T00:00:00Z",
};
const passport = signPassport(body, secretKey);

await mkdir("public/.well-known", { recursive: true });
await writeFile("public/.well-known/agent-passport.json", JSON.stringify(passport, null, 2) + "\n");
await writeFile(
  "spec/fixtures/self-keypair.json",
  JSON.stringify({ note: "DEV key — prod uses a human-gated key", secret_key_hex: bytesToHex(secretKey) }, null, 2) + "\n",
);
console.log("Wrote public/.well-known/agent-passport.json (dogfood self-passport)");
