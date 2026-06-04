import { test } from "node:test";
import assert from "node:assert/strict";
import { parseEntry, fetchRegistryPage } from "../src/lib/registry/mcp";
import { jsonLdScript } from "../src/lib/jsonld";

test("jsonLdScript: escapes </script> breakout but stays valid JSON", () => {
  const evil = { name: "x</script><script>alert(1)</script>", desc: "a & b > c < d" };
  const out = jsonLdScript(evil);
  assert.ok(!out.includes("</script>"), "no raw </script> breakout");
  assert.ok(!out.includes("<"), "no raw < ");
  assert.ok(!out.includes(">"), "no raw >");
  assert.deepEqual(JSON.parse(out), evil, "still parses back to the original object");
});

const sampleEl = {
  server: {
    $schema: "https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json",
    name: "io.github.acme/cool-mcp",
    description: "A cool MCP server",
    repository: { url: "https://github.com/acme/cool-mcp", source: "github" },
    version: "1.2.0",
    websiteUrl: "https://acme.dev",
    packages: [{ registryType: "npm", identifier: "cool-mcp" }],
  },
  _meta: {
    "io.modelcontextprotocol.registry/official": {
      status: "active",
      isLatest: true,
      updatedAt: "2026-05-01T00:00:00Z",
    },
  },
};

test("parseEntry: normalizes a full entry and keeps the raw original", () => {
  const e = parseEntry(sampleEl)!;
  assert.equal(e.name, "io.github.acme/cool-mcp");
  assert.equal(e.description, "A cool MCP server");
  assert.equal(e.repoUrl, "https://github.com/acme/cool-mcp");
  assert.equal(e.websiteUrl, "https://acme.dev");
  assert.equal(e.version, "1.2.0");
  assert.equal(e.status, "active");
  assert.equal(e.isLatest, true);
  assert.equal(e.updatedAt, "2026-05-01T00:00:00Z");
  assert.deepEqual(e.original, sampleEl); // drift resilience
});

test("parseEntry: skips a row with no name", () => {
  assert.equal(parseEntry({ server: { description: "x" } }), null);
  assert.equal(parseEntry({}), null);
  assert.equal(parseEntry(null), null);
});

test("parseEntry: tolerates missing optional fields + unknown extras", () => {
  const e = parseEntry({
    server: { name: "io.x/y", futureField: 123 }, // unknown extra, no repo/desc/packages
    _meta: {},
  })!;
  assert.equal(e.name, "io.x/y");
  assert.equal(e.description, null);
  assert.equal(e.repoUrl, null);
  assert.equal(e.status, "active"); // default
  assert.equal(e.isLatest, true); // default when absent
});

test("parseEntry: isLatest:false is respected", () => {
  const e = parseEntry({ server: { name: "io.x/old" }, _meta: { "io.modelcontextprotocol.registry/official": { isLatest: false } } })!;
  assert.equal(e.isLatest, false);
});

test("fetchRegistryPage: parses page, returns nextCursor, sets version=latest + updated_since", async () => {
  let seenUrl = "";
  const fetchImpl = async (url: string) => {
    seenUrl = url;
    return new Response(
      JSON.stringify({ servers: [sampleEl, { server: {} }], metadata: { nextCursor: "c2" } }),
      { status: 200 },
    );
  };
  const page = await fetchRegistryPage({ updatedSince: "2026-05-01T00:00:00Z", fetchImpl });
  assert.equal(page.entries.length, 1); // the {server:{}} row was skipped
  assert.equal(page.rawCount, 2);
  assert.equal(page.nextCursor, "c2");
  assert.match(seenUrl, /version=latest/);
  assert.match(seenUrl, /updated_since=2026-05-01/);
});
