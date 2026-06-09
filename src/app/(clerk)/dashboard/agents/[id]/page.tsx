import Link from "next/link";
import { notFound } from "next/navigation";
import { getOwnedAgent } from "@/lib/agents";
import { pendingChallengeToken } from "@/lib/verification/service";
import { expectedTxtRecord } from "@/lib/verification/dns";
import { VerificationBadge, type AgentStatus } from "@/components/verification-badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DnsVerify, WellKnownVerify } from "./verify-panel";

export default async function AgentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const agent = await getOwnedAgent(id);
  if (!agent) notFound();

  const token = (await pendingChallengeToken(agent.id)) ?? "";
  const wellKnownUrl = `https://${agent.domain}/.well-known/agent-passport.json`;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const profileUrl = `${appUrl}/agent/${agent.slug}`;
  const badgeUrl = `${profileUrl}/badge`;
  const markdownSnippet = `[![PassportForAgents](${badgeUrl})](${profileUrl})`;

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-12">
      <Link href="/dashboard" className="font-mono text-xs text-muted-foreground">
        ← dashboard
      </Link>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{agent.name}</h1>
          <p className="mt-1 font-mono text-sm text-muted-foreground">
            {agent.domain}
          </p>
        </div>
        <VerificationBadge status={agent.status as AgentStatus} />
      </div>

      <p className="mt-3 text-sm">
        Public profile:{" "}
        <Link href={`/agent/${agent.slug}`} className="font-mono underline">
          /agent/{agent.slug}
        </Link>
      </p>

      <h2 className="mt-10 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Prove domain control
      </h2>

      {/* PRIMARY: .well-known signature */}
      <Card className="mt-3">
        <CardHeader>
          <CardTitle className="text-base">
            Option A · Signed <code className="font-mono">.well-known</code> file
            <span className="ml-2 rounded bg-success/10 px-1.5 py-0.5 text-xs font-normal text-success">
              recommended — reaches key-verified
            </span>
          </CardTitle>
          <CardDescription>
            Host your Ed25519-signed passport at the URL below, then verify. See{" "}
            <Link href="/spec" className="underline">
              the spec
            </Link>{" "}
            for the document format and signing steps.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <pre className="overflow-x-auto rounded-md border border-border bg-muted/40 p-3 font-mono text-xs">
            {wellKnownUrl}
          </pre>
          <WellKnownVerify agentId={agent.id} />
        </CardContent>
      </Card>

      {/* SECONDARY: DNS TXT */}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">
            Option B · DNS TXT record
            <span className="ml-2 rounded bg-warning/10 px-1.5 py-0.5 text-xs font-normal text-warning">
              domain-verified only
            </span>
          </CardTitle>
          <CardDescription>
            Add this TXT record to <span className="font-mono">{agent.domain}</span>, then verify.
            Proves domain control but not key ownership.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <pre className="overflow-x-auto rounded-md border border-border bg-muted/40 p-3 font-mono text-xs">
            {expectedTxtRecord(token)}
          </pre>
          <DnsVerify agentId={agent.id} />
        </CardContent>
      </Card>

      <h2 className="mt-10 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Embed your badge
      </h2>
      <Card className="mt-3">
        <CardHeader>
          <CardTitle className="text-base">Verified-Agent badge</CardTitle>
          <CardDescription>
            A live, cacheable SVG that reflects current status + trust score and
            links back to your public profile. Drop it in your README.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/agent/${agent.slug}/badge`} alt="PassportForAgents badge" className="h-5" />
          <pre className="overflow-x-auto rounded-md border border-border bg-muted/40 p-3 font-mono text-xs">
            {markdownSnippet}
          </pre>
        </CardContent>
      </Card>

      {agent.status !== "unverified" && (
        <p className="mt-6 text-sm text-muted-foreground">
          Already verified? Re-run a check above anytime — passports can rotate and
          we always trust the currently-served document.
        </p>
      )}

      <div className="mt-8">
        <Button asChild variant="ghost" size="sm">
          <Link href={`/agent/${agent.slug}`}>View public profile →</Link>
        </Button>
      </div>
    </div>
  );
}
