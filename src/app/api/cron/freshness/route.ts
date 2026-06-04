import { runFreshnessSweep } from "@/lib/webhooks/service";
import { cronAuthorized } from "@/lib/cron-auth";

/**
 * Freshness sweep cron. Vercel Cron calls this with
 * `Authorization: Bearer <CRON_SECRET>` (set CRON_SECRET in the project env).
 * Fires freshness-change webhooks. Schedule in vercel.json.
 */
export async function GET(req: Request) {
  if (!cronAuthorized(req)) return new Response("unauthorized", { status: 401 });
  const summary = await runFreshnessSweep();
  return Response.json({ ok: true, ...summary });
}
