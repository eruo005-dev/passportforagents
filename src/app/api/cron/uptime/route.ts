import { runUptimeSweep } from "@/lib/uptime/service";
import { cronAuthorized } from "@/lib/cron-auth";

/** Uptime health-probe cron (Vercel Cron, Bearer CRON_SECRET). */
export async function GET(req: Request) {
  if (!cronAuthorized(req)) return new Response("unauthorized", { status: 401 });
  const summary = await runUptimeSweep();
  return Response.json({ ok: true, ...summary });
}
