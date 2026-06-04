import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root to this project. Without it, Next walks up and may
  // pick up an unrelated lockfile in a parent directory.
  turbopack: {
    root: import.meta.dirname,
  },
};

export default nextConfig;
