#!/usr/bin/env -S npx tsx
/**
 * PassportForAgents — standalone reference verifier  (MIT-licensed)
 *
 * Verifies an Agent Passport with ZERO dependence on the hosted PassportForAgents
 * service. It only needs the document (fetched live from a domain, or a local
 * file) plus three small audited crypto libs (@noble, @scure, canonicalize).
 *
 * Usage:
 *   npm run verify -- <domain>                 # fetch https://<domain>/.well-known/... and verify
 *   npm run verify -- --file <path.json>       # verify a local file (signature only)
 *   npm run verify -- --file <path.json> --host <domain>   # + check domain match
 *
 * Exit code 0 = valid, 1 = invalid/failed.
 */
import { readFile } from "node:fs/promises";
import {
  fetchAndVerify,
  verifyPassport,
  type VerifyResult,
} from "../src/lib/passport/core";
import type { PassportForAgents } from "../src/lib/passport/types";

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function printChecks(r: VerifyResult) {
  const mark = (b: boolean) => (b ? "✓" : "✗");
  console.log(`  ${mark(r.checks.public_key_wellformed)} public key well-formed (ed25519 Multikey)`);
  console.log(`  ${mark(r.checks.signature_valid)} signature verifies over JCS-canonicalized body`);
  console.log(`  ${mark(r.checks.domain_matches)} serving host matches owner_domain`);
  if (r.listedAgents && r.listedAgents.length > 0) {
    console.log(`  ✓ ${r.listedAgents.length} signed sub-agent(s):`);
    for (const a of r.listedAgents) console.log(`      · ${a.id} (${a.name})`);
  }
}

async function main() {
  const filePath = arg("--file");
  const host = arg("--host") ?? null;

  if (filePath) {
    const raw = await readFile(filePath, "utf8");
    const doc = JSON.parse(raw) as PassportForAgents;
    console.log(`\nVerifying local file: ${filePath}`);
    console.log(`  agent_name:   ${doc.agent_name}`);
    console.log(`  owner_domain: ${doc.owner_domain}`);
    if (host === null) {
      console.log("  (no --host given → checking signature only, skipping domain match)\n");
    }
    const result = verifyPassport(doc, host);
    printChecks(result);
    finish(result.valid, result.error);
    return;
  }

  const domain = process.argv.slice(2).find((a) => !a.startsWith("--"));
  if (!domain) {
    console.error(
      "Usage:\n  verify <domain>\n  verify --file <path.json> [--host <domain>]",
    );
    process.exit(2);
  }

  console.log(`\nFetching & verifying: ${domain}`);
  const result = await fetchAndVerify(domain);
  console.log(`  url: ${result.url}`);
  if (result.document) {
    console.log(`  agent_name:   ${result.document.agent_name}`);
    console.log(`  owner_domain: ${result.document.owner_domain}`);
  }
  printChecks(result);
  finish(result.valid, result.error);
}

function finish(valid: boolean, error?: string) {
  console.log("");
  if (valid) {
    console.log("RESULT: ✓ VALID — identity confirmed (domain control + valid signature)\n");
    process.exit(0);
  } else {
    console.log(`RESULT: ✗ INVALID${error ? ` — ${error}` : ""}\n`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("verifier error:", e);
  process.exit(1);
});
