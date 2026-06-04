import { getAgentBySlug } from "@/lib/agents";
import { loadTrustScore } from "@/lib/trust/load";
import { renderBadgeSvg, BADGE_CACHE_CONTROL } from "@/lib/badge";
import type { AgentStatus } from "@/components/verification-badge";

/**
 * GET /agent/[slug]/badge — live, cacheable "Verified Agent" SVG badge.
 * Anonymous (embeddable cross-origin). 404 SVG for unknown slug.
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { slug } = await ctx.params;
  const data = await getAgentBySlug(slug);

  if (!data) {
    const svg = renderBadgeSvg({ status: "unverified", score: 0, label: "agentpassport" });
    return new Response(svg, {
      status: 404,
      headers: {
        "content-type": "image/svg+xml; charset=utf-8",
        "cache-control": "public, max-age=60",
      },
    });
  }

  const { score } = await loadTrustScore(data.agent.id);
  const svg = renderBadgeSvg({
    status: data.agent.status as AgentStatus,
    score,
  });

  return new Response(svg, {
    status: 200,
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      "cache-control": BADGE_CACHE_CONTROL,
    },
  });
}
