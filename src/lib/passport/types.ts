/**
 * The Agent Passport document — the open, MIT-licensed schema served at
 * https://<owner_domain>/.well-known/agent-passport.json
 *
 * See SPEC.md for the normative definition. This file is the TypeScript
 * mirror of that spec and is intentionally dependency-free so it can be
 * copied into a standalone verifier.
 */

export const SPEC_VERSION = "0.1.0" as const;

export type AgentType = "mcp_server" | "a2a_agent";

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
