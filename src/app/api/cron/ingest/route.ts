import { runRegistryIngest } from "@/lib/registry/ingest";

/**
 * MCP Registry ingest cron. Vercel Cron calls this with
 * `Authorization: Bearer <CRON_SECRET>`. Incremental mirror into registry_ingest.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return new Response("unauthorized", { status: 401 });
  }
  const summary = await runRegistryIngest();
  return Response.json({ ok: true, ...summary });
}
