import "server-only";
import { eq } from "drizzle-orm";
import { currentUser } from "@clerk/nextjs/server";
import { db } from "@/db";
import { owners } from "@/db/schema";

/**
 * Ensure an `owners` row exists for the currently signed-in Clerk user,
 * creating it on first visit. Returns the owner record, or null if not signed in.
 */
export async function ensureOwner() {
  const user = await currentUser();
  if (!user) return null;

  const email =
    user.primaryEmailAddress?.emailAddress ??
    user.emailAddresses[0]?.emailAddress ??
    "";

  const existing = await db.query.owners.findFirst({
    where: eq(owners.clerkUserId, user.id),
  });
  if (existing) return existing;

  await db
    .insert(owners)
    .values({ clerkUserId: user.id, email })
    .onConflictDoNothing({ target: owners.clerkUserId });

  return (
    (await db.query.owners.findFirst({
      where: eq(owners.clerkUserId, user.id),
    })) ?? null
  );
}
