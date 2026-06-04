import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { ensureOwner } from "@/lib/owners";
import { listWebhooks } from "@/lib/webhooks/service";
import { WebhooksManager, type WebhookRow } from "./webhooks-panel";

export default async function WebhooksPage() {
  const owner = await ensureOwner();
  const webhooks = owner ? await listWebhooks(owner.id) : [];

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

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
        <Link href="/dashboard" className="font-mono text-xs text-muted-foreground">
          ← dashboard
        </Link>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">Webhooks</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Get notified when one of your agents&apos; verification goes stale or
          fresh again. We POST an HMAC-signed event to your endpoint; verify the{" "}
          <code className="font-mono">x-passportforagents-signature</code> header.
        </p>

        <div className="mt-8">
          <WebhooksManager webhooks={webhooks as WebhookRow[]} />
        </div>
      </main>
    </div>
  );
}
