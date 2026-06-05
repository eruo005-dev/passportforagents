import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { agents, domains, trustSignals } from "@/db/schema";
import { baseSlug, uniqueSlug } from "@/lib/slug";
import { generateAgentPublicId } from "@/lib/ids";
import { TRUST_WEIGHTS } from "@/lib/trust/weights";

type Status = "unverified" | "domain_verified" | "key_verified" | "suspended";
const RANK: Record<Status, number> = {
  suspended: -1,
  unverified: 0,
  domain_verified: 1,
  key_verified: 2,
};

/** Upsert (owner, domain) to at least `status`, never downgrading. Returns id. */
export async function upsertVerifiedDomain(
  ownerId: string,
  domain: string,
  status: Status,
  evidence?: unknown,
): Promise<string> {
  const existing = await db.query.domains.findFirst({
    where: and(eq(domains.ownerId, ownerId), eq(domains.domain, domain)),
  });
  if (existing) {
    const best = RANK[existing.status as Status] >= RANK[status] ? existing.status : status;
    await db
      .update(domains)
      .set({ status: best, verifiedAt: new Date(), evidence: (evidence ?? null) as object })
      .where(eq(domains.id, existing.id));
    return existing.id;
  }
  const [row] = await db
    .insert(domains)
    .values({ ownerId, domain, status, verifiedAt: new Date(), evidence: (evidence ?? null) as object })
    .returning();
  return row.id;
}

/**
 * After an agent verifies, promote its domain to a first-class verified `domains`
 * row and link the agent to it — so other agents can register under it later.
 */
export async function linkVerifiedDomain(agentId: string): Promise<void> {
  const agent = await db.query.agents.findFirst({ where: eq(agents.id, agentId) });
  if (!agent) return;
  if (agent.status !== "domain_verified" && agent.status !== "key_verified") return;
  const domain = agent.verifiedDomain ?? agent.domain;
  const id = await upsertVerifiedDomain(agent.ownerId, domain, agent.status, { via: agentId });
  await db.update(agents).set({ domainId: id }).where(eq(agents.id, agentId));
}

/**
 * Create a sub-agent under one of the owner's VERIFIED domains (owner-scoped,
 * Clerk-free → testable). Inherits the domain's status; gets its own agt_ id.
 */
export async function createSubAgentForOwner(
  ownerId: string,
  input: { domainId: string; name: string; capabilities?: string[] },
) {
  const domain = await db.query.domains.findFirst({
    where: and(eq(domains.id, input.domainId), eq(domains.ownerId, ownerId)),
  });
  if (!domain) throw new Error("Verified domain not found");
  if (domain.status === "unverified") throw new Error("That domain isn't verified yet");

  const name = input.name.trim();
  if (!name) throw new Error("Name is required");

  const slugExists = async (c: string) =>
    Boolean(await db.query.agents.findFirst({ where: eq(agents.slug, c) }));
  const base = baseSlug(name, domain.domain);

  let agent;
  for (let attempt = 0; attempt < 5; attempt++) {
    const slug = await uniqueSlug(base, slugExists);
    try {
      [agent] = await db
        .insert(agents)
        .values({
          ownerId,
          type: "a2a_agent",
          name,
          slug,
          publicId: generateAgentPublicId(),
          domain: domain.domain,
          domainId: domain.id,
          verifiedDomain: domain.domain,
          capabilities: input.capabilities ?? [],
          status: domain.status, // inherits the verified domain's status
        })
        .returning();
      break;
    } catch (e) {
      if ((e as { code?: string }).code === "23505" && attempt < 4) continue;
      throw e;
    }
  }
  if (!agent) throw new Error("Could not create sub-agent (slug contention)");

  // Inherit the domain's identity trust signals so the score reflects its
  // verified-via-domain status (domain control proven; key_verified domains also
  // carry signed provenance). Independent per-agent scans are a later sprint.
  const inherited: ("domain_control" | "signed_provenance")[] =
    domain.status === "key_verified"
      ? ["domain_control", "signed_provenance"]
      : ["domain_control"];
  await db.insert(trustSignals).values(
    inherited.map((t) => ({
      agentId: agent!.id,
      signalType: t,
      value: 1,
      weight: TRUST_WEIGHTS[t],
      raw: { inheritedFromDomain: domain.domain } as object,
    })),
  );

  return agent;
}
