import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { ensureOwner } from "@/lib/owners";
import { listOwnerAgents } from "@/lib/agents";
import { Button } from "@/components/ui/button";
import { VerificationBadge, type AgentStatus } from "@/components/verification-badge";

export default async function DashboardPage() {
  const owner = await ensureOwner();
  const agents = await listOwnerAgents();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-border">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
          <Link href="/" className="font-mono text-sm font-semibold tracking-tight">
            agent<span className="text-muted-foreground">passport</span>
          </Link>
          <UserButton />
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-12">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Your agents</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {owner?.email ? `Signed in as ${owner.email}. ` : ""}
              Claim an MCP server and prove control of its domain.
            </p>
          </div>
          <Button asChild>
            <Link href="/dashboard/agents/new">+ Claim MCP server</Link>
          </Button>
        </div>

        {agents.length === 0 ? (
          <div className="mt-10 rounded-lg border border-dashed border-border p-10 text-center">
            <p className="text-sm text-muted-foreground">
              No agents yet. Claim your first MCP server to get a verified badge
              and a public profile.
            </p>
            <Button asChild className="mt-4">
              <Link href="/dashboard/agents/new">Claim your first server</Link>
            </Button>
          </div>
        ) : (
          <ul className="mt-8 divide-y divide-border rounded-lg border border-border">
            {agents.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-4 p-4">
                <div className="min-w-0">
                  <Link
                    href={`/dashboard/agents/${a.id}`}
                    className="font-medium hover:underline"
                  >
                    {a.name}
                  </Link>
                  <p className="truncate font-mono text-xs text-muted-foreground">
                    {a.domain} · /agent/{a.slug}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <VerificationBadge status={a.status as AgentStatus} />
                  <Button asChild variant="ghost" size="sm">
                    <Link href={`/dashboard/agents/${a.id}`}>Manage</Link>
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
