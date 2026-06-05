/**
 * The Agent Passport document — the open, MIT-licensed schema served at
 * https://<owner_domain>/.well-known/agent-passport.json
 *
 * See SPEC.md for the normative definition. This file is the TypeScript
 * mirror of that spec and is intentionally dependency-free so it can be
 * copied into a standalone verifier.
 */

export const SPEC_VERSION = "0.2.0" as const;
/** Versions this library accepts (additive minor bumps stay compatible). */
export const SUPPORTED_SPEC_VERSIONS = ["0.1.0", "0.2.0"] as const;

export type AgentType = "mcp_server" | "a2a_agent";

/**
 * A sub-agent operated under the owner_domain (spec 0.2.0+). Because this lives
 * inside the signed body, every listed sub-agent's identity is cryptographically
 * carried by the domain's single Ed25519 signature — per-agent identity with no
 * per-agent key and no DID. `public_key` is optional (a sub-agent MAY also carry
 * its own key) but identity does not require it.
 */
export interface SubAgent {
  /** Stable, domain-scoped identifier for this sub-agent (e.g. "the_ethicist"). */
  id: string;
  name: string;
  capabilities: string[];
  public_key?: string;
}

/** The signed body — every field EXCEPT `signature` is covered by the signature. */
export interface PassportForAgentsBody {
  /** Spec version this document conforms to, e.g. "0.1.0". */
  spec_version: string;
  /** Human-readable agent name. */
  agent_name: string;
  /** Agent kind. v1 beachhead is `mcp_server`. */
  agent_type: AgentType;
  /** The domain that controls this identity. MUST match the host serving the file. */
  owner_domain: string;
  /** Ed25519 public key as a multibase Multikey ("z..." base58btc, ed25519-pub). */
  public_key: string;
  /** Declared capabilities (free-form tags; e.g. MCP tool/resource names). */
  capabilities: string[];
  /** Project homepage URL. */
  homepage?: string;
  /** Source repository URL. */
  repo?: string;
  /** Sub-agents operated under this domain (spec 0.2.0+). Signed → each is
   *  identity-anchored to the domain key. Optional + additive; absent in 0.1.0. */
  agents?: SubAgent[];
  /** RFC 3339 timestamp of when this document was issued/signed. */
  issued_at: string;
}

/** The full document = signed body + detached signature over its JCS form. */
export interface PassportForAgents extends PassportForAgentsBody {
  /** Detached Ed25519 signature over the JCS-canonicalized body, base58btc multibase. */
  signature: string;
}

/** Field that is excluded from the signed body. */
export const SIGNATURE_FIELD = "signature" as const;
