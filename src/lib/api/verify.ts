import "server-only";
import { eq, or } from "drizzle-orm";
import { db } from "@/db";
import { agents, owners } from "@/db/schema";
import { loadTrustScore } from "@/lib/trust/load";
import { normalizeHost } from "@/lib/passport/core";
import { isAgentPublicId } from "@/lib/ids";
import { quotaForPlan, PLAN_QUOTAS } from "@/lib/billing/plans";
import {
  authenticateApiKey,
  grantBillableCall,
  logVerificationCall,
} from "@/lib/api-keys/service";

/** Free-tier monthly quota — kept for dashboard display. */
export const FREE_VERIFY_QUOTA = PLAN_QUOTAS.free;

export type VerifyApiResult = { status: number; body: Record<string, unknown> };

/** Resolve an agent by public Agent ID (agt_…), slug, or claimed/verified domain. */
export async function findAgentForApi(query: string) {
  const q = query.trim();
  if (isAgentPublicId(q)) {
    const byId = await db.query.agents.findFirst({ where: eq(agents.publicId, q) });
    return byId ?? null;
  }
  const bySlug = await db.query.agents.findFirst({ where: eq(agents.slug, q) });
  if (bySlug) return bySlug;
  const host = normalizeHost(q);
  const byDomain = await db.query.agents.findFirst({
    where: or(eq(agents.verifiedDomain, host), eq(agents.domain, host)),
  });
  return byDomain ?? null;
}

/**
 * Core public Verify API logic (HTTP-agnostic, unit/integration testable).
 * Auth → resolve → ATOMIC quota grant (the billable call is logged inside the
 * same transaction that enforces the quota, closing the TOCTOU). The quota is
 * the owner's PLAN quota unless `args.quota` overrides (tests).
 */
export async function runVerify(args: {
  presentedKey: string | null;
  agentQuery: string | null;
  quota?: number;
}): Promise<VerifyApiResult> {
  const auth = await authenticateApiKey(args.presentedKey);
  if (!auth) {
    // Unauthenticated calls are not logged (no key to attribute to).
    return { status: 401, body: { error: "missing or invalid API key" } };
  }

  const owner = await db.query.owners.findFirst({ where: eq(owners.id, auth.ownerId) });
  const quota = args.quota ?? quotaForPlan(owner?.planTier ?? "free");

  if (!args.agentQuery) {
    await logVerificationCall(auth.apiKey.id, null, { result: "bad_request" });
    return { status: 400, body: { error: "missing ?agent= parameter" } };
  }

  const agent = await findAgentForApi(args.agentQuery);
  if (!agent) {
    await logVerificationCall(auth.apiKey.id, null, { result: "not_found", query: args.agentQuery });
    return { status: 404, body: { error: "agent not found" } };
  }

  const trust = await loadTrustScore(agent.id);
  const verified = agent.status === "key_verified" || agent.status === "domain_verified";

  // Atomic: enforce quota AND log the billable call in one transaction.
  const granted = await grantBillableCall(
    auth.apiKey.id,
    auth.ownerId,
    agent.id,
    { result: "ok", status: agent.status, score: trust.score },
    quota,
  );
  if (!granted) {
    await logVerificationCall(auth.apiKey.id, null, { result: "quota_exceeded" });
    return {
      status: 429,
      body: { error: "monthly quota exceeded", quota, plan: owner?.planTier ?? "free" },
    };
  }

  const body = {
    agent: {
      id: agent.publicId,
      slug: agent.slug,
      name: agent.name,
      type: agent.type,
      owner_domain: agent.verifiedDomain ?? agent.domain,
      public_key: agent.publicKey,
      capabilities: agent.capabilities ?? [],
    },
    status: agent.status,
    verified,
    trust: { score: trust.score, breakdown: trust.breakdown },
    checked_at: new Date().toISOString(),
  };
  return { status: 200, body };
}
