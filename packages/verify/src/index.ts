/**
 * @passportforagents/verify — "verify before connect" SDK for MCP clients & gateways.
 *
 * ZERO npm dependencies: Ed25519 verification uses the platform WebCrypto
 * (Node 18+, Deno, edge runtimes, modern browsers); base58/JCS are inlined.
 *
 * Two modes:
 *  - verifyStandalone(domain): fetch the domain's .well-known/agent-passport.json
 *    and verify the signature + domain locally — ZERO dependence on any hosted
 *    PassportForAgents service.
 *  - verifyHosted({agent, apiKey}): call the hosted Verify API for identity +
 *    status + trust score in one request.
 */
import { decodePublicKey, decodeSignature } from "./base58.js";
import { jcsBytes } from "./jcs.js";

export type AgentPassport = {
  spec_version: string;
  agent_name: string;
  agent_type: string;
  owner_domain: string;
  public_key: string;
  capabilities: string[];
  homepage?: string;
  repo?: string;
  issued_at: string;
  signature: string;
};

export type StandaloneResult = {
  valid: boolean;
  checks: { signature_valid: boolean; domain_matches: boolean; public_key_wellformed: boolean };
  document: AgentPassport | null;
  error?: string;
};

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

function normalizeHost(host: string): string {
  return host.trim().toLowerCase().replace(/^www\./, "").replace(/:\d+$/, "");
}

/** Copy into a fresh ArrayBuffer-backed buffer (WebCrypto wants BufferSource). */
function ab(u: Uint8Array): ArrayBuffer {
  const buf = new ArrayBuffer(u.byteLength);
  new Uint8Array(buf).set(u);
  return buf;
}

async function ed25519Verify(sig: Uint8Array, msg: Uint8Array, pub: Uint8Array): Promise<boolean> {
  try {
    const key = await crypto.subtle.importKey("raw", ab(pub), { name: "Ed25519" }, false, ["verify"]);
    return await crypto.subtle.verify({ name: "Ed25519" }, key, ab(sig), ab(msg));
  } catch {
    return false;
  }
}

/** Verify a parsed passport document. `servedHost` null = signature-only mode. */
export async function verifyPassport(
  doc: AgentPassport,
  servedHost: string | null,
): Promise<StandaloneResult> {
  const checks = { signature_valid: false, domain_matches: false, public_key_wellformed: false };
  let pub: Uint8Array;
  try {
    pub = decodePublicKey(doc.public_key);
    checks.public_key_wellformed = true;
  } catch (e) {
    return { valid: false, checks, document: doc, error: `public_key: ${(e as Error).message}` };
  }
  try {
    const body: Record<string, unknown> = { ...doc };
    delete body.signature;
    const sig = decodeSignature(doc.signature);
    checks.signature_valid = await ed25519Verify(sig, jcsBytes(body), pub);
  } catch (e) {
    return { valid: false, checks, document: doc, error: `signature: ${(e as Error).message}` };
  }
  checks.domain_matches =
    servedHost === null ? true : normalizeHost(servedHost) === normalizeHost(doc.owner_domain);

  const valid = checks.signature_valid && checks.domain_matches && checks.public_key_wellformed;
  return {
    valid,
    checks,
    document: doc,
    error: valid
      ? undefined
      : !checks.signature_valid
        ? "signature did not verify"
        : "domain mismatch",
  };
}

/** Fetch a domain's passport over HTTPS and verify it end-to-end. */
export async function verifyStandalone(
  domain: string,
  opts: { fetchImpl?: FetchLike } = {},
): Promise<StandaloneResult> {
  const host = normalizeHost(domain);
  const url = `https://${host}/.well-known/agent-passport.json`;
  const fetchImpl = opts.fetchImpl ?? (fetch as FetchLike);
  let res: Response;
  try {
    res = await fetchImpl(url, { redirect: "error", headers: { accept: "application/json" } });
  } catch (e) {
    return emptyResult(`fetch failed: ${(e as Error).message}`);
  }
  if (!res.ok) return emptyResult(`HTTP ${res.status}`);
  let doc: AgentPassport;
  try {
    doc = (await res.json()) as AgentPassport;
  } catch (e) {
    return emptyResult(`invalid JSON: ${(e as Error).message}`);
  }
  return verifyPassport(doc, host);
}

function emptyResult(error: string): StandaloneResult {
  return {
    valid: false,
    checks: { signature_valid: false, domain_matches: false, public_key_wellformed: false },
    document: null,
    error,
  };
}

export type HostedResult = {
  ok: boolean;
  status: number;
  agent?: { slug: string; name: string; type: string; owner_domain: string; public_key: string | null; capabilities: string[] };
  verified?: boolean;
  trust?: { score: number; breakdown: unknown[] };
  error?: string;
};

/** Query the hosted Verify API for identity + status + trust score. */
export async function verifyHosted(opts: {
  agent: string;
  apiKey: string;
  baseUrl?: string;
  fetchImpl?: FetchLike;
}): Promise<HostedResult> {
  const base = (opts.baseUrl ?? "https://passportforagents.com").replace(/\/$/, "");
  const url = `${base}/api/v1/verify?agent=${encodeURIComponent(opts.agent)}`;
  const fetchImpl = opts.fetchImpl ?? (fetch as FetchLike);
  const res = await fetchImpl(url, { headers: { authorization: `Bearer ${opts.apiKey}` } });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    return { ok: false, status: res.status, error: (body.error as string) ?? `HTTP ${res.status}` };
  }
  return {
    ok: true,
    status: res.status,
    agent: body.agent as HostedResult["agent"],
    verified: body.verified as boolean,
    trust: body.trust as HostedResult["trust"],
  };
}
