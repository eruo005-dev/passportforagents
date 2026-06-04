import { runFreshnessSweep } from "@/lib/webhooks/service";

/**
 * Freshness sweep cron. Vercel Cron calls this with
 * `Authorization: Bearer <CRON_SECRET>` (set CRON_SECRET in the project env).
 * Fires freshness-change webhooks. Schedule in vercel.json.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return new Response("unauthorized", { status: 401 });
  }
  const summary = await runFreshnessSweep();
  return Response.json({ ok: true, ...summary });
}
