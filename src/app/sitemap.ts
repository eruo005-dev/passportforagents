import type { MetadataRoute } from "next";
import { db } from "@/db";
import { agents } from "@/db/schema";
import { listRegistryForSitemap } from "@/lib/registry/ingest";

// Generated at request time (reads the DB) rather than at build.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "https://passportforagents.com").replace(/\/$/, "");

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/spec`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/registry`, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/docs`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/pricing`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/about`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${base}/privacy`, changeFrequency: "monthly", priority: 0.2 },
    { url: `${base}/terms`, changeFrequency: "monthly", priority: 0.2 },
  ];

  const claimed = await db.select({ slug: agents.slug, lastSeenAt: agents.lastSeenAt }).from(agents);
  const agentRoutes: MetadataRoute.Sitemap = claimed.map((a) => ({
    url: `${base}/agent/${a.slug}`,
    lastModified: a.lastSeenAt ?? undefined,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  const reg = await listRegistryForSitemap(5000);
  const regRoutes: MetadataRoute.Sitemap = reg.map((r) => ({
    url: `${base}/registry/${r.name.split("/").map(encodeURIComponent).join("/")}`,
    lastModified: r.updatedAt ? new Date(r.updatedAt) : undefined,
    changeFrequency: "weekly",
    priority: 0.5,
  }));

  return [...staticRoutes, ...agentRoutes, ...regRoutes];
}
