import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { ensureOwner } from "@/lib/owners";

export default async function DashboardPage() {
  // Route is gated by middleware; ensure the owner row exists on first visit.
  const owner = await ensureOwner();

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
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Welcome{owner?.email ? `, ${owner.email}` : ""}. This is the owner
          shell — claiming and verifying MCP servers lands in Sprint 2.
        </p>

        <dl className="mt-8 grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-border p-4">
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">
              Plan
            </dt>
            <dd className="mt-1 font-mono text-sm">{owner?.planTier ?? "—"}</dd>
          </div>
          <div className="rounded-lg border border-border p-4">
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">
              Owner ID
            </dt>
            <dd className="mt-1 truncate font-mono text-xs">{owner?.id ?? "—"}</dd>
          </div>
          <div className="rounded-lg border border-border p-4">
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">
              Agents
            </dt>
            <dd className="mt-1 font-mono text-sm">0</dd>
          </div>
        </dl>
      </main>
    </div>
  );
}
