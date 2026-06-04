import "server-only";
import { randomBytes } from "node:crypto";
import { and, asc, eq, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { agents, trustSignals, verifications } from "@/db/schema";
import { fetchAndVerify, type FetchAndVerifyResult } from "@/lib/passport/core";
import { TRUST_WEIGHTS } from "@/lib/trust/weights";
import { safeFetch } from "./safe-fetch";
import { checkDnsChallenge, type DnsCheckResult } from "./dns";
import { scanSecretHygiene } from "./secret-hygiene";
import { fetchAndVerifyA2ACard } from "../a2a/fetch";

const VERIFICATION_TTL_DAYS = 90;

export function generateChallengeToken(): string {
  return randomBytes(24).toString("hex");
}

function expiry(): Date {
  return new Date(Date.now() + VERIFICATION_TTL_DAYS * 24 * 60 * 60 * 1000);
}

/** Replace any existing trust signal of a type with the latest value. */
async function upsertTrustSignal(
  agentId: string,
  signalType: keyof typeof TRUST_WEIGHTS,
  value: number,
  raw?: unknown,
) {
  await db
    .delete(trustSignals)
    .where(
      and(
        eq(trustSignals.agentId, agentId),
        eq(trustSignals.signalType, signalType),
      ),
    );
  await db.insert(trustSignals).values({
    agentId,
    signalType,
    value,
    weight: TRUST_WEIGHTS[signalType],
    raw: (raw ?? null) as object | null,
  });
}

/**
 * Get the DNS challenge token for an agent (issued at claim time).
 * Scoped to dns_txt rows with a non-null token and ordered oldest-first, so a
 * later well_known verification (which stores no token) can never poison this
 * lookup.
 */
export async function pendingChallengeToken(
  agentId: string,
): Promise<string | null> {
  const row = await db.query.verifications.findFirst({
    where: and(
      eq(verifications.agentId, agentId),
      eq(verifications.method, "dns_txt"),
      isNotNull(verifications.challengeToken),
    ),
    orderBy: [asc(verifications.createdAt)],
  });
  return row?.challengeToken ?? null;
}

/**
 * Run the `.well-known` HTTPS + signature verification and persist the outcome.
 * On success the agent reaches `key_verified` and its public key / capabilities
 * are mirrored from the signed document.
 */
export async function verifyWellKnown(
  agentId: string,
  domain: string,
  fetchImpl: (input: string, init?: RequestInit) => Promise<Response> = safeFetch,
) {
  const result: FetchAndVerifyResult = await fetchAndVerify(domain, fetchImpl);

  await db.insert(verifications).values({
    agentId,
    method: "well_known",
    evidence: {
      url: result.url,
      checks: result.checks,
      fetched: result.fetched,
      error: result.error ?? null,
    },
    verifiedAt: result.valid ? new Date() : null,
    expiresAt: result.valid ? expiry() : null,
  });

  if (result.valid && result.document) {
    await db
      .update(agents)
      .set({
        status: "key_verified",
        verifiedDomain: result.document.owner_domain,
        publicKey: result.document.public_key,
        capabilities: result.document.capabilities ?? [],
        homepageUrl: result.document.homepage ?? undefined,
        repoUrl: result.document.repo ?? undefined,
        lastSeenAt: new Date(),
      })
      .where(eq(agents.id, agentId));

    await upsertTrustSignal(agentId, "domain_control", 1, { method: "well_known" });
    await upsertTrustSignal(agentId, "signed_provenance", 1, {
      public_key: result.document.public_key,
    });
  } else {
    await db
      .update(agents)
      .set({ lastSeenAt: new Date() })
      .where(eq(agents.id, agentId));
  }

  return result;
}

/**
 * MCP secret-hygiene scan for an agent's OWN claimed domain (derived from the
 * agent record — never a caller-supplied domain). Writes the `secret_hygiene`
 * trust signal: clean = 1, exposed = 0. `fetchImpl` injectable for tests.
 */
export async function runSecretHygieneScan(
  agentId: string,
  fetchImpl: (input: string, init?: RequestInit) => Promise<Response> = safeFetch,
) {
  const agent = await db.query.agents.findFirst({ where: eq(agents.id, agentId) });
  if (!agent) return null;
  const domain = agent.verifiedDomain ?? agent.domain;

  const result = await scanSecretHygiene(domain, fetchImpl);
  await upsertTrustSignal(agentId, "secret_hygiene", result.exposed ? 0 : 1, {
    checked: result.checked,
    findings: result.findings, // path + redacted reason only — never the value
  });
  return result;
}

/**
 * Fetch + verify an agent's A2A signed Agent Card and persist the outcome.
 * On success the agent reaches `key_verified` as an `a2a_agent`, mirroring the
 * card's skills as capabilities. Flows into the existing trust score + Verify
 * API with no scoring changes. `fetchImpl` injectable for tests.
 */
export async function verifyA2AForAgent(
  agentId: string,
  fetchImpl: (input: string, init?: RequestInit) => Promise<Response> = safeFetch,
) {
  const agent = await db.query.agents.findFirst({ where: eq(agents.id, agentId) });
  if (!agent) return null;

  const result = await fetchAndVerifyA2ACard(agent.domain, fetchImpl);

  await db.insert(verifications).values({
    agentId,
    method: "a2a_card",
    evidence: {
      url: result.url,
      checks: result.checks,
      keyHost: result.keyHost,
      spec: "a2a-v1.0.0",
      error: result.error ?? null,
    },
    verifiedAt: result.valid ? new Date() : null,
    expiresAt: result.valid ? expiry() : null,
  });

  if (result.valid && result.card) {
    const skills = (result.card.skills ?? [])
      .map((s) => s.id || s.name)
      .filter(Boolean) as string[];
    await db
      .update(agents)
      .set({
        type: "a2a_agent",
        status: "key_verified",
        verifiedDomain: result.keyHost ?? agent.domain,
        capabilities: skills,
        homepageUrl: result.card.provider?.url ?? agent.homepageUrl ?? undefined,
        lastSeenAt: new Date(),
      })
      .where(eq(agents.id, agentId));
    await upsertTrustSignal(agentId, "domain_control", 1, { method: "a2a_card" });
    await upsertTrustSignal(agentId, "signed_provenance", 1, { a2a: true });
  } else {
    await db.update(agents).set({ lastSeenAt: new Date() }).where(eq(agents.id, agentId));
  }

  return result;
}

/**
 * Run the DNS TXT domain-control check and persist the outcome. Reaches
 * `domain_verified` (never downgrades an already `key_verified` agent).
 */
export async function verifyDns(agentId: string, domain: string, token: string) {
  const result: DnsCheckResult = await checkDnsChallenge(domain, token);

  await db.insert(verifications).values({
    agentId,
    method: "dns_txt",
    challengeToken: token,
    evidence: {
      records: result.records,
      matched: result.matched,
      error: result.error ?? null,
    },
    verifiedAt: result.matched ? new Date() : null,
    expiresAt: result.matched ? expiry() : null,
  });

  if (result.matched) {
    const agent = await db.query.agents.findFirst({
      where: eq(agents.id, agentId),
    });
    // Don't downgrade a cryptographically key-verified agent.
    if (agent && agent.status !== "key_verified") {
      await db
        .update(agents)
        .set({
          status: "domain_verified",
          verifiedDomain: domain,
          lastSeenAt: new Date(),
        })
        .where(eq(agents.id, agentId));
    }
    await upsertTrustSignal(agentId, "domain_control", 1, { method: "dns_txt" });
  }

  return result;
}
