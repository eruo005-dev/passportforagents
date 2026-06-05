import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { agents, domains, verifications } from "@/db/schema";
import { ensureOwner } from "@/lib/owners";
import { baseSlug, uniqueSlug } from "@/lib/slug";
import { generateChallengeToken } from "@/lib/verification/service";
import { generateAgentPublicId } from "@/lib/ids";
import { createSubAgentForOwner } from "@/lib/domains";
import { normalizeHost } from "@/lib/passport/core";

export { createSubAgentForOwner };

export type ClaimInput = {
  name: string;
  domain: string;
  description?: string;
};

/** Claim a new MCP server: create the agent + a pending DNS challenge token. */
export async function claimAgent(input: ClaimInput) {
  const owner = await ensureOwner();
  if (!owner) throw new Error("Not signed in");

  const name = input.name.trim();
  const domain = normalizeHost(input.domain);
  if (!name) throw new Error("Name is required");
  if (!domain || !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) {
    throw new Error("Enter a valid domain, e.g. example.com");
  }

  const slugExists = async (candidate: string) => {
    const existing = await db.query.agents.findFirst({
      where: eq(agents.slug, candidate),
    });
    return Boolean(existing);
  };

  const base = baseSlug(name, domain);

  // Insert with a unique slug; on a concurrent-claim race the DB unique
  // constraint (23505) wins for one writer — the loser recomputes and retries.
  let agent;
  for (let attempt = 0; attempt < 5; attempt++) {
    const slug = await uniqueSlug(base, slugExists);
    try {
      [agent] = await db
        .insert(agents)
        .values({
          ownerId: owner.id,
          type: "mcp_server",
          name,
          slug,
          publicId: generateAgentPublicId(),
          domain,
          description: input.description?.trim() || null,
          verifiedDomain: null,
          status: "unverified",
        })
        .returning();
      break;
    } catch (e) {
      if ((e as { code?: string }).code === "23505" && attempt < 4) continue;
      throw e;
    }
  }
  if (!agent) throw new Error("Could not create agent (slug contention)");

  // Pending challenge token for the DNS TXT flow.
  await db.insert(verifications).values({
    agentId: agent.id,
    method: "dns_txt",
    challengeToken: generateChallengeToken(),
  });

  return agent;
}

/**
 * Register a sub-agent under one of the owner's VERIFIED domains. It inherits
 * the domain's status (verified once → many agents inherit) and gets its own
 * stable public Agent ID + slug + profile + badge.
 */
export async function registerSubAgent(input: {
  domainId: string;
  name: string;
  capabilities?: string[];
}) {
  const owner = await ensureOwner();
  if (!owner) throw new Error("Not signed in");
  return createSubAgentForOwner(owner.id, input);
}

/** Verified domains the current owner can register agents under. */
export async function listOwnerDomains() {
  const owner = await ensureOwner();
  if (!owner) return [];
  return db.query.domains.findMany({
    where: eq(domains.ownerId, owner.id),
    orderBy: [desc(domains.createdAt)],
  });
}

/** All agents owned by the current user. */
export async function listOwnerAgents() {
  const owner = await ensureOwner();
  if (!owner) return [];
  return db.query.agents.findMany({
    where: eq(agents.ownerId, owner.id),
    orderBy: [desc(agents.createdAt)],
  });
}

/** Fetch an agent only if the current user owns it (server-side authz). */
export async function getOwnedAgent(id: string) {
  const owner = await ensureOwner();
  if (!owner) return null;
  const agent = await db.query.agents.findFirst({
    where: and(eq(agents.id, id), eq(agents.ownerId, owner.id)),
  });
  return agent ?? null;
}

/** Public profile lookup by slug, with its latest verification rows. */
export async function getAgentBySlug(slug: string) {
  const agent = await db.query.agents.findFirst({
    where: eq(agents.slug, slug),
  });
  if (!agent) return null;
  const verifs = await db.query.verifications.findMany({
    where: eq(verifications.agentId, agent.id),
    orderBy: [desc(verifications.createdAt)],
  });
  return { agent, verifications: verifs };
}
