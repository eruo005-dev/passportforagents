import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { MCP_SERVER_MANIFEST, validateMcpManifest, type McpManifest } from "../src/lib/mcp/manifest";

test("mcp manifest: passes registry-required validation + no secrets", () => {
  const r = validateMcpManifest(MCP_SERVER_MANIFEST);
  assert.deepEqual(r.errors, []);
  assert.equal(r.valid, true);
});

test("mcp manifest: validator rejects bad name / missing fields / secrets", () => {
  assert.equal(validateMcpManifest({ ...MCP_SERVER_MANIFEST, name: "notnamespaced" }).valid, false);
  assert.equal(validateMcpManifest({ ...MCP_SERVER_MANIFEST, description: "" }).valid, false);
  const leaky = { ...MCP_SERVER_MANIFEST, description: "key is sk_live_abc123" };
  assert.equal(validateMcpManifest(leaky).valid, false);
});

test("mcp manifest: committed mcp-server.json matches the source of truth", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const file = JSON.parse(readFileSync(join(here, "..", "mcp-server.json"), "utf8")) as McpManifest;
  assert.equal(file.name, MCP_SERVER_MANIFEST.name);
  assert.equal(validateMcpManifest(file).valid, true);
});
