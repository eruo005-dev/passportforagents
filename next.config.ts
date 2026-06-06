import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root to this project. Without it, Next walks up and may
  // pick up an unrelated lockfile in a parent directory.
  turbopack: {
    root: import.meta.dirname,
  },
  // Application-level security headers on every response. CSP is deliberately
  // NOT added here yet: a strict policy must be hand-tuned to allow Clerk's
  // script/connect/frame origins or it breaks sign-in — tracked as a follow-up
  // (ship a Clerk-tested CSP, ideally Report-Only first). These five are safe.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
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
