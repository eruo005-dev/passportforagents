/**
 * PassportForAgents' own MCP server manifest, for self-listing in the official
 * MCP Registry (dogfood / distribution). PREP ONLY — publishing requires DNS/
 * namespace proof + registry credentials (human-gated). Validated by a test.
 *
 * NOTE: `remotes`/`packages` are intentionally omitted until a live MCP protocol
 * endpoint exists — we must not advertise a connect target that isn't served.
 * Add the `remotes` entry (and build the `/mcp` endpoint) BEFORE publishing.
 */
export type McpManifest = {
  $schema: string;
  name: string;
  description: string;
  version: string;
  repository: { url: string; source: string };
  websiteUrl?: string;
  remotes?: { type: string; url: string }[];
};

export const MCP_SERVER_MANIFEST: McpManifest = {
  $schema: "https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json",
  name: "com.passportforagents/verify",
  description:
    "Verify whether an MCP or A2A agent is who it claims to be: identity (domain control + Ed25519), verification status, and a transparent 0–100 trust score.",
  version: "0.1.0",
  repository: { url: "https://github.com/eruo005-dev/passportforagents", source: "github" },
  websiteUrl: "https://passportforagents.com",
};

/** Validate the manifest against the registry's required fields + a no-secrets guard. */
export function validateMcpManifest(m: McpManifest): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+\/[a-z0-9._-]+$/i.test(m.name ?? "")) {
    errors.push("name must be a reverse-DNS namespace, e.g. com.example/server");
  }
  if (!m.description) errors.push("description is required");
  if (!m.version) errors.push("version is required");
  if (!m.repository?.url) errors.push("repository.url is required");
  if (!m.$schema?.startsWith("https://")) errors.push("$schema must be an https URL");
  // No secrets must ever appear in a published manifest.
  if (/sk_live_|sk_test_|whsec_|secret_key|private key|bearer\s/i.test(JSON.stringify(m))) {
    errors.push("manifest contains a secret-shaped string");
  }
  return { valid: errors.length === 0, errors };
}
