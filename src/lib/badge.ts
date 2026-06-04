/**
 * Embeddable "Verified Agent" badge — a shields.io-style SVG generated live
 * from the agent's current verification status + trust score. Pure + testable.
 *
 * The badge is a LIVE lookup (not a static image the owner uploads), so it can't
 * be spoofed: a suspended/unverified agent can never show a "verified" badge.
 */
import type { AgentStatus } from "@/components/verification-badge";

const COLORS: Record<AgentStatus, string> = {
  key_verified: "#2ea043", // green
  domain_verified: "#bf8700", // amber
  unverified: "#6e7681", // gray
  suspended: "#cf222e", // red
};

const STATUS_LABEL: Record<AgentStatus, string> = {
  key_verified: "key-verified",
  domain_verified: "domain-verified",
  unverified: "unverified",
  suspended: "suspended",
};

function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, (c) =>
    c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === "&" ? "&amp;" : c === "'" ? "&apos;" : "&quot;",
  );
}

// Rough monospace-ish width estimate at 11px.
const charW = 6.5;
const pad = 8;

export function renderBadgeSvg(opts: {
  status: AgentStatus;
  score: number;
  label?: string;
}): string {
  const left = opts.label ?? "agentpassport";
  const right =
    opts.status === "unverified" || opts.status === "suspended"
      ? STATUS_LABEL[opts.status]
      : `${STATUS_LABEL[opts.status]} · ${Math.round(opts.score)}`;
  const color = COLORS[opts.status] ?? COLORS.unverified;

  const lw = Math.ceil(left.length * charW + pad * 2);
  const rw = Math.ceil(right.length * charW + pad * 2);
  const w = lw + rw;
  const lx = lw / 2;
  const rx = lw + rw / 2;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="20" role="img" aria-label="${escapeXml(left)}: ${escapeXml(right)}">
  <title>${escapeXml(left)}: ${escapeXml(right)}</title>
  <linearGradient id="s" x2="0" y2="100%"><stop offset="0" stop-color="#bbb" stop-opacity=".1"/><stop offset="1" stop-opacity=".1"/></linearGradient>
  <clipPath id="r"><rect width="${w}" height="20" rx="3" fill="#fff"/></clipPath>
  <g clip-path="url(#r)">
    <rect width="${lw}" height="20" fill="#24292f"/>
    <rect x="${lw}" width="${rw}" height="20" fill="${color}"/>
    <rect width="${w}" height="20" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11">
    <text x="${lx}" y="14">${escapeXml(left)}</text>
    <text x="${rx}" y="14">${escapeXml(right)}</text>
  </g>
</svg>`;
}

/** Cache headers for the badge: short TTL so revocation propagates fast. */
export const BADGE_CACHE_CONTROL =
  "public, max-age=300, s-maxage=300, stale-while-revalidate=60";
