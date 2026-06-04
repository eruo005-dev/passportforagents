import "server-only";
import { eq, or } from "drizzle-orm";
import { db } from "@/db";
import { agents } from "@/db/schema";
import { loadTrustScore } from "@/lib/trust/load";
import { normalizeHost } from "@/lib/passport/core";
import {
  authenticateApiKey,
  logVerificationCall,
  monthlyUsage,
} from "@/lib/api-keys/service";

/** Free verify-API calls per owner per month before 429 (see RESEARCH pass 001). */
export const FREE_VERIFY_QUOTA = 1000;

export type VerifyApiResult = { status: number; body: Record<string, unknown> };

/** Resolve an agent by slug, id, or claimed/verified domain. */
async function findAgentForApi(query: string) {
  const q = query.trim();
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
 * Auth → quota → resolve → log every authenticated call.
 */
export async function runVerify(args: {
  presentedKey: string | null;
  agentQuery: string | null;
  /** Override the free quota (tests only); defaults to FREE_VERIFY_QUOTA. */
  quota?: number;
}): Promise<VerifyApiResult> {
  const quota = args.quota ?? FREE_VERIFY_QUOTA;
  const auth = await authenticateApiKey(args.presentedKey);
  if (!auth) {
    // Unauthenticated calls are not logged (no key to attribute to).
    return { status: 401, body: { error: "missing or invalid API key" } };
  }

  // Quota meter.
  const used = await monthlyUsage(auth.ownerId);
  if (used >= quota) {
    await logVerificationCall(auth.apiKey.id, null, { result: "quota_exceeded" });
    return {
      status: 429,
      body: { error: "free quota exceeded", quota, used },
    };
  }

  if (!args.agentQuery) {
    await logVerificationCall(auth.apiKey.id, null, { result: "bad_request" });
    return { status: 400, body: { error: "missing ?agent= parameter" } };
  }

  const agent = await findAgentForApi(args.agentQuery);
  if (!agent) {
    await logVerificationCall(auth.apiKey.id, null, {
      result: "not_found",
      query: args.agentQuery,
    });
    return { status: 404, body: { error: "agent not found" } };
  }

  const trust = await loadTrustScore(agent.id);
  const verified = agent.status === "key_verified" || agent.status === "domain_verified";

  const body = {
    agent: {
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

  await logVerificationCall(auth.apiKey.id, agent.id, {
    result: "ok",
    status: agent.status,
    score: trust.score,
  });

  return { status: 200, body };
}
