import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { and, desc, eq, gte, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { apiKeys, owners, verificationCalls } from "@/db/schema";

const KEY_PREFIX = "ap_live_";

/** sha256 of the plaintext key. Only the hash is ever stored. */
export function hashKey(plaintext: string): string {
  return createHash("sha256").update(plaintext).digest("hex");
}

/** Create a new API key. Returns the plaintext ONCE — it is never recoverable. */
export async function createApiKey(ownerId: string, label?: string) {
  const plaintext = KEY_PREFIX + randomBytes(24).toString("hex");
  const keyPrefix = plaintext.slice(0, KEY_PREFIX.length + 6) + "…";
  const [record] = await db
    .insert(apiKeys)
    .values({
      ownerId,
      keyHash: hashKey(plaintext),
      keyPrefix,
      label: label?.trim() || null,
    })
    .returning();
  return { plaintext, record };
}

export async function listApiKeys(ownerId: string) {
  return db.query.apiKeys.findMany({
    where: eq(apiKeys.ownerId, ownerId),
    orderBy: [desc(apiKeys.createdAt)],
  });
}

/** Soft-revoke a key the caller owns. */
export async function revokeApiKey(ownerId: string, keyId: string) {
  await db
    .update(apiKeys)
    .set({ revokedAt: new Date() })
    .where(and(eq(apiKeys.id, keyId), eq(apiKeys.ownerId, ownerId), isNull(apiKeys.revokedAt)));
}

/**
 * Authenticate a presented key: hash-compare against non-revoked keys.
 * Updates lastUsedAt. Returns the key row + owner id, or null.
 */
export async function authenticateApiKey(presented: string | null) {
  if (!presented || !presented.startsWith(KEY_PREFIX)) return null;
  const keyHash = hashKey(presented);
  const row = await db.query.apiKeys.findFirst({
    where: and(eq(apiKeys.keyHash, keyHash), isNull(apiKeys.revokedAt)),
  });
  if (!row) return null;
  await db
    .update(apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKeys.id, row.id));
  return { apiKey: row, ownerId: row.ownerId };
}

function startOfUtcMonth(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/** Single source of truth for "billable (result=ok) calls this UTC month".
 *  Used by BOTH the display meter and the enforced quota grant so they can't
 *  drift. Works against the db or a transaction. */
type DbOrTx = Pick<typeof db, "select">;
async function countBillableThisMonth(executor: DbOrTx, ownerId: string): Promise<number> {
  const [row] = await executor
    .select({ count: sql<number>`count(*)::int` })
    .from(verificationCalls)
    .innerJoin(apiKeys, eq(verificationCalls.apiKeyId, apiKeys.id))
    .where(
      and(
        eq(apiKeys.ownerId, ownerId),
        gte(verificationCalls.calledAt, startOfUtcMonth()),
        sql`${verificationCalls.result}->>'result' = 'ok'`,
      ),
    );
  return row?.count ?? 0;
}

/** This owner's billable verify calls in the current UTC month (dashboard meter). */
export async function monthlyUsage(ownerId: string): Promise<number> {
  return countBillableThisMonth(db, ownerId);
}

/**
 * ATOMIC quota grant: within one transaction, lock the owner row, count this
 * month's billable calls, and insert the billable call ONLY if under quota.
 * The per-owner FOR UPDATE lock serializes concurrent calls so two requests at
 * `used = quota-1` can never both succeed (closes the TOCTOU). Returns true if
 * the call was granted (and logged as the billable record), false if over quota.
 */
export async function grantBillableCall(
  apiKeyId: string,
  ownerId: string,
  agentId: string | null,
  result: Record<string, unknown>,
  quota: number,
): Promise<boolean> {
  let granted = false;
  await db.transaction(async (tx) => {
    await tx.execute(sql`select 1 from owners where ${owners.id} = ${ownerId} for update`);
    // Same count predicate as the dashboard meter — single source of truth.
    if ((await countBillableThisMonth(tx, ownerId)) < quota) {
      await tx.insert(verificationCalls).values({ apiKeyId, agentId, result });
      granted = true;
    }
  });
  return granted;
}

/** Log a billable verification call. */
export async function logVerificationCall(
  apiKeyId: string,
  agentId: string | null,
  result: Record<string, unknown>,
) {
  await db.insert(verificationCalls).values({ apiKeyId, agentId, result });
}
