import "server-only";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { agents, reviews } from "@/db/schema";
import { upsertTrustSignal } from "@/lib/verification/service";

/** A reviewer must themselves own at least one verified agent (sybil resistance). */
export async function isVerifiedOwner(ownerId: string): Promise<boolean> {
  const row = await db.query.agents.findFirst({
    where: and(
      eq(agents.ownerId, ownerId),
      inArray(agents.status, ["key_verified", "domain_verified"]),
    ),
  });
  return Boolean(row);
}

/** Recompute the `user_rating` trust signal (0..1 = avg rating / 5). */
export async function recomputeUserRating(agentId: string) {
  const [agg] = await db
    .select({ avg: sql<number>`avg(${reviews.rating})::float`, count: sql<number>`count(*)::int` })
    .from(reviews)
    .where(eq(reviews.agentId, agentId));
  const count = agg?.count ?? 0;
  const avg = count > 0 ? Number(agg.avg) : 0;
  await upsertTrustSignal(agentId, "user_rating", count > 0 ? avg / 5 : 0, { avg, count });
  return { avg, count };
}

/**
 * Submit (or update) one review for an agent. Rules: reviewer must be a verified
 * owner, cannot review their own agent, and gets exactly one review per agent
 * (enforced by uq_review_owner_agent — updated on conflict).
 */
export async function submitReview(
  reviewerOwnerId: string,
  agentId: string,
  rating: number,
  comment: string | null,
) {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new Error("Rating must be an integer 1–5");
  }
  const agent = await db.query.agents.findFirst({ where: eq(agents.id, agentId) });
  if (!agent) throw new Error("Agent not found");
  if (agent.ownerId === reviewerOwnerId) throw new Error("You can't review your own agent");
  if (!(await isVerifiedOwner(reviewerOwnerId))) {
    throw new Error("Only verified owners can review");
  }

  await db
    .insert(reviews)
    .values({ agentId, reviewerOwnerId, rating, comment: comment?.trim() || null })
    .onConflictDoUpdate({
      target: [reviews.agentId, reviews.reviewerOwnerId],
      set: { rating, comment: comment?.trim() || null },
    });

  return recomputeUserRating(agentId);
}

/** Aggregate + recent reviews for a public profile. */
export async function getAgentReviews(agentId: string, limit = 10) {
  const rows = await db.query.reviews.findMany({
    where: eq(reviews.agentId, agentId),
    orderBy: [desc(reviews.createdAt)],
    limit,
  });
  const count = rows.length;
  const avg = count > 0 ? rows.reduce((s, r) => s + r.rating, 0) / count : 0;
  return { reviews: rows, avg, count };
}
