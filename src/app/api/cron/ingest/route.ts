import { runRegistryIngest } from "@/lib/registry/ingest";
import { cronAuthorized } from "@/lib/cron-auth";

/**
 * MCP Registry ingest cron. Vercel Cron calls this with
 * `Authorization: Bearer <CRON_SECRET>`. Incremental mirror into registry_ingest.
 */
export async function GET(req: Request) {
  if (!cronAuthorized(req)) return new Response("unauthorized", { status: 401 });
  const summary = await runRegistryIngest();
  return Response.json({ ok: true, ...summary });
}
