import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getAgentBySlug } from "@/lib/agents";
import { VerificationBadge, type AgentStatus } from "@/components/verification-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const data = await getAgentBySlug(slug);
  if (!data) return { title: "Agent not found — AgentPassport" };
  return {
    title: `${data.agent.name} — AgentPassport`,
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

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-border">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-6">
          <Link href="/" className="font-mono text-sm font-semibold tracking-tight">
            agent<span className="text-muted-foreground">passport</span>
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
