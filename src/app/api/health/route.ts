import { sql } from "drizzle-orm";
import { db } from "@/db";

export const dynamic = "force-dynamic";

/**
 * Liveness + DB readiness probe for uptime monitors. 200 = app up and the
 * database answered; 503 = degraded (DB unreachable). No secrets, no caching.
 */
export async function GET() {
  const startedAt = Date.now();
  try {
    await db.execute(sql`select 1`);
    return Response.json(
      { status: "ok", db: "up", latency_ms: Date.now() - startedAt },
      { headers: { "cache-control": "no-store" } },
    );
  } catch {
    return Response.json(
      { status: "degraded", db: "down" },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
}
