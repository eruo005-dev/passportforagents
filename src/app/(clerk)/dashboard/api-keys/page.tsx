import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { ensureOwner } from "@/lib/owners";
import { listApiKeys, monthlyUsage } from "@/lib/api-keys/service";
import { FREE_VERIFY_QUOTA } from "@/lib/api/verify";
import { KeysManager, type KeyRow } from "./keys-panel";

export default async function ApiKeysPage() {
  const owner = await ensureOwner();
  const keys = owner ? await listApiKeys(owner.id) : [];
  const used = owner ? await monthlyUsage(owner.id) : 0;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-border">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
          <Link href="/" className="font-mono text-sm font-semibold tracking-tight">
            passport<span className="text-muted-foreground">foragents</span>
          </Link>
          <UserButton />
        </div>
      </header>

      <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
        <Link href="/dashboard" className="font-mono text-xs text-muted-foreground">
          ← dashboard
        </Link>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">API keys</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Authenticate the public Verify API. Usage is metered per key.
        </p>

        <div className="mt-6 rounded-lg border border-border p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Verify calls this month
          </p>
          <p className="mt-1 font-mono text-sm">
            {used.toLocaleString()} / {FREE_VERIFY_QUOTA.toLocaleString()}{" "}
            <span className="text-muted-foreground">free</span>
          </p>
        </div>

        <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Use it
        </h2>
        <pre className="mt-2 overflow-x-auto rounded-md border border-border bg-muted/40 p-3 font-mono text-xs">
{`curl -H "Authorization: Bearer <your-key>" \\
  "${process.env.NEXT_PUBLIC_APP_URL ?? ""}/api/v1/verify?agent=<slug-or-domain>"`}
        </pre>

        <div className="mt-8">
          <KeysManager keys={keys as KeyRow[]} />
        </div>
      </main>
    </div>
  );
}
