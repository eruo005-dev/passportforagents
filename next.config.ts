import type { NextConfig } from "next";

// Content-Security-Policy tuned to allow Clerk (auth) + Next while constraining
// where scripts/styles/connections may load from. 'unsafe-inline' is required
// for Next's inline bootstrap + Clerk (a nonce-based strict policy is a future
// tightening). Verified against live sign-in before shipping.
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
  "object-src 'none'",
  "img-src 'self' data: blob: https://img.clerk.com https://*.clerk.com",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-inline' https://*.clerk.accounts.dev https://*.clerk.com https://clerk.passportforagents.com https://challenges.cloudflare.com",
  "connect-src 'self' https://*.clerk.accounts.dev https://*.clerk.com https://clerk.passportforagents.com",
  "worker-src 'self' blob:",
  "frame-src 'self' https://challenges.cloudflare.com",
  "upgrade-insecure-requests",
].join("; ");

const nextConfig: NextConfig = {
  // Pin the workspace root to this project. Without it, Next walks up and may
  // pick up an unrelated lockfile in a parent directory.
  turbopack: {
    root: import.meta.dirname,
  },
  // Application-level security headers on every response.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: CONTENT_SECURITY_POLICY },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
