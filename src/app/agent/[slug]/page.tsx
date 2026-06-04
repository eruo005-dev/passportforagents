import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getAgentBySlug } from "@/lib/agents";
import { loadTrustScore } from "@/lib/trust/load";
import { VerificationBadge, type AgentStatus } from "@/components/verification-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const data = await getAgentBySlug(slug);
  if (!data) return { title: "Agent not found — PassportForAgents" };
  return {
    title: `${data.agent.name} — PassportForAgents`,
    description: `Verification status and identity for ${data.agent.name} (${data.agent.domain}).`,
  };
}

function truncateKey(key: string | null): string {
  if (!key) return "—";
  return key.length > 24 ? `${key.slice(0, 16)}…${key.slice(-6)}` : key;
}

export default async function PublicProfile({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await getAgentBySlug(slug);
  if (!data) notFound();
  const { agent, verifications } = data;

  const lastVerified = verifications.find((v) => v.verifiedAt)?.verifiedAt ?? null;
  const trust = await loadTrustScore(agent.id);
  const activeSignals = trust.breakdown.filter((r) => r.value > 0);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const ownerDomain = agent.verifiedDomain ?? agent.domain;
  // JSON-LD structured data → SEO + AI-citation (AEO/GEO) of verified facts.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: agent.name,
    applicationCategory: "DeveloperApplication",
    operatingSystem: "Model Context Protocol",
    url: `${appUrl}/agent/${agent.slug}`,
    ...(agent.description ? { description: agent.description } : {}),
    ...(agent.homepageUrl || agent.repoUrl
      ? { sameAs: [agent.homepageUrl, agent.repoUrl].filter(Boolean) }
      : {}),
    publisher: {
      "@type": "Organization",
      name: ownerDomain,
      url: `https://${ownerDomain}`,
    },
    additionalProperty: [
      { "@type": "PropertyValue", name: "verificationStatus", value: agent.status },
      { "@type": "PropertyValue", name: "trustScore", value: trust.score, maxValue: 100 },
    ],
  };

  return (
    <div className="flex min-h-screen flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <header className="border-b border-border">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-6">
          <Link href="/" className="font-mono text-sm font-semibold tracking-tight">
            passport<span className="text-muted-foreground">foragents</span>
          </Link>
          <Link href="/spec" className="text-xs text-muted-foreground hover:underline">
            How verification works
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-semibold tracking-tight">{agent.name}</h1>
          <VerificationBadge status={agent.status as AgentStatus} />
        </div>
        <p className="mt-2 font-mono text-sm text-muted-foreground">{agent.domain}</p>
        {agent.description && (
          <p className="mt-4 max-w-2xl text-muted-foreground">{agent.description}</p>
        )}

        <dl className="mt-8 grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">
                Identity
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div>
                <span className="text-muted-foreground">Owner domain: </span>
                <span className="font-mono">{agent.verifiedDomain ?? agent.domain}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Public key: </span>
                <span className="font-mono text-xs">{truncateKey(agent.publicKey)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Type: </span>
                <span className="font-mono">{agent.type}</span>
              </div>
              {lastVerified && (
                <div>
                  <span className="text-muted-foreground">Verified: </span>
                  <span>{new Date(lastVerified).toISOString().slice(0, 10)}</span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">
                Capabilities
              </CardTitle>
            </CardHeader>
            <CardContent>
              {agent.capabilities && agent.capabilities.length > 0 ? (
                <ul className="flex flex-wrap gap-1.5">
                  {agent.capabilities.map((c) => (
                    <li
                      key={c}
                      className="rounded border border-border bg-muted/40 px-2 py-0.5 font-mono text-xs"
                    >
                      {c}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  None declared{agent.status === "unverified" ? " yet" : ""}.
                </p>
              )}
            </CardContent>
          </Card>
        </dl>

        {/* Transparent trust score — a documented weighted sum, never a black box. */}
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="flex items-baseline justify-between text-xs uppercase tracking-wide text-muted-foreground">
              <span>Trust score</span>
              <span className="font-mono text-2xl font-semibold text-foreground">
                {trust.score}
                <span className="text-sm text-muted-foreground">/100</span>
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activeSignals.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No verified signals yet. Self-asserted claims carry zero weight
                until independently checked.
              </p>
            ) : (
              <ul className="space-y-2">
                {trust.breakdown.map((r) => (
                  <li key={r.signalType} className="flex items-center gap-3 text-sm">
                    <span className="w-40 shrink-0 font-mono text-xs text-muted-foreground">
                      {r.signalType}
                    </span>
                    <span className="relative h-2 flex-1 overflow-hidden rounded-full bg-muted">
                      <span
                        className="absolute inset-y-0 left-0 rounded-full bg-success"
                        style={{ width: `${Math.round(r.value * 100)}%` }}
                      />
                    </span>
                    <span className="w-14 shrink-0 text-right font-mono text-xs text-muted-foreground">
                      +{Math.round(r.contribution * 100)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-4 text-xs text-muted-foreground">
              Transparent weighted sum of independently verified signals.{" "}
              <Link href="/spec" className="underline">
                How it&apos;s computed
              </Link>
              .
            </p>
          </CardContent>
        </Card>

        {(agent.homepageUrl || agent.repoUrl) && (
          <div className="mt-6 flex gap-4 text-sm">
            {agent.homepageUrl && (
              <a href={agent.homepageUrl} className="underline" rel="nofollow noopener">
                Homepage
              </a>
            )}
            {agent.repoUrl && (
              <a href={agent.repoUrl} className="underline" rel="nofollow noopener">
                Repository
              </a>
            )}
          </div>
        )}

        {agent.status === "unverified" && (
          <p className="mt-8 rounded-md border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
            This agent has been claimed but has not yet proven control of its
            domain. Treat its self-asserted details as unverified.
          </p>
        )}
      </main>
    </div>
  );
}
