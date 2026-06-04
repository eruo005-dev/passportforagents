import { runVerify } from "@/lib/api/verify";

/**
 * GET /api/v1/verify?agent=<slug|domain>
 * Public, API-key-authenticated. Returns identity + status + trust score.
 * Auth: `Authorization: Bearer <key>` or `x-api-key: <key>`.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const agentQuery = url.searchParams.get("agent");

  const authz = req.headers.get("authorization");
  const bearer = authz?.toLowerCase().startsWith("bearer ")
    ? authz.slice(7).trim()
    : null;
  const presentedKey = bearer ?? req.headers.get("x-api-key");

  const { status, body } = await runVerify({ presentedKey, agentQuery });

  const headers: Record<string, string> = {
    "content-type": "application/json",
    "cache-control": "no-store",
  };
  if (status === 401) headers["www-authenticate"] = "Bearer";

  return new Response(JSON.stringify(body, null, 2), { status, headers });
}
