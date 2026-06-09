import type { MetadataRoute } from "next";

/** Surfaces that are useless/private for any crawler. */
const PRIVATE = ["/dashboard", "/sign-in", "/sign-up"];

/**
 * Popular AI crawlers/agents, explicitly welcomed (GEO: we WANT answer engines
 * to read the spec, registry, and live trust endpoints and cite them). They get
 * everything except auth surfaces — including /api/, so assistants can fetch
 * public, keyless endpoints like /api/v1/trust-attestation.
 */
const AI_CRAWLERS = [
  "GPTBot", // OpenAI training
  "OAI-SearchBot", // ChatGPT search
  "ChatGPT-User", // ChatGPT browsing on behalf of users
  "ClaudeBot", // Anthropic
  "Claude-User",
  "Claude-SearchBot",
  "anthropic-ai",
  "PerplexityBot",
  "Perplexity-User",
  "Google-Extended", // Gemini training
  "Applebot-Extended",
  "meta-externalagent",
  "cohere-ai",
  "DuckAssistBot",
  "MistralAI-User",
];

export default function robots(): MetadataRoute.Robots {
  const base = (
    process.env.NEXT_PUBLIC_APP_URL ?? "https://passportforagents.com"
  ).replace(/\/$/, "");
  return {
    rules: [
      // AI systems: everything public, including the keyless API surface.
      ...AI_CRAWLERS.map((userAgent) => ({
        userAgent,
        allow: "/",
        disallow: PRIVATE,
      })),
      // Everyone else: public pages; keep API + auth out of search indexes.
      {
        userAgent: "*",
        allow: "/",
        disallow: [...PRIVATE, "/api/"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
