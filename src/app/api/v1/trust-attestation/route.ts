import { findAgentForApi } from "@/lib/api/verify";
import { loadTrustScore } from "@/lib/trust/load";
import { issueTrustAttestation, issuerConfigured } from "@/lib/trust/issuer";
import { rateLimit, clientIp } from "@/lib/rate-limit";

/**
 * GET /api/v1/trust-attestation?agent=<agt_id|slug|domain>
 *
 * PUBLIC and unauthenticated (deliberately — the whole point is that anyone can
 * fetch the signed object and recompute it offline with zero trust in us; see
 * `npm run verify:attestation`). Cacheable. Returns a signed,
 * independently-recomputable Trust Attestation.
 *
 * 400 if no ?agent=; 503 if the issuer key isn't configured; 404 if unknown.
 */
function json(status: number, body: unknown, cache = "no-store") {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "content-type": "application/json", "cache-control": cache },
  });
}

export async function GET(req: Request) {
  // Throttle this keyless endpoint (it does DB lookups + an Ed25519 signature
  // per call) to blunt DoS / cost-amplification. 30 req/min/IP; cacheable
  // responses are additionally absorbed by the CDN.
  const rl = rateLimit(`attest:${clientIp(req)}`, 30, 60_000);
  if (!rl.ok) {
    return new Response(JSON.stringify({ error: "rate limit exceeded" }), {
      status: 429,
      headers: {
        "content-type": "application/json",
        "retry-after": String(rl.retryAfter),
        "cache-control": "no-store",
      },
    });
  }

  const agentQuery = new URL(req.url).searchParams.get("agent");
  if (!agentQuery) return json(400, { error: "missing ?agent= parameter" });
  if (!issuerConfigured())
    return json(503, { error: "trust attestation issuer key not configured" });

  const agent = await findAgentForApi(agentQuery);
  if (!agent) return json(404, { error: "agent not found" });

  const trust = await loadTrustScore(agent.id);
  const att = issueTrustAttestation({
    subject: {
      agent_id: agent.publicId,
      owner_domain: agent.verifiedDomain ?? agent.domain,
    },
    signals: trust.breakdown.map((b) => ({
      signalType: b.signalType,
      value: b.value,
    })),
    now: new Date(),
  });
  if (!att)
    return json(503, { error: "trust attestation issuer key unavailable" });

  // Public + cacheable: it's a signed object anyone can re-verify offline.
  return json(200, att, "public, max-age=300");
}
