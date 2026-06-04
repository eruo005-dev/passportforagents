import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { trustSignals } from "@/db/schema";
import { computeTrustScore, type TrustScore } from "./score";
import type { TrustSignalType } from "./weights";

/** Load an agent's trust signals from the DB and compute its transparent score. */
export async function loadTrustScore(agentId: string): Promise<TrustScore> {
  const rows = await db.query.trustSignals.findMany({
    where: eq(trustSignals.agentId, agentId),
  });
  return computeTrustScore(
    rows.map((r) => ({
      signalType: r.signalType as TrustSignalType,
      value: r.value,
    })),
  );
}
