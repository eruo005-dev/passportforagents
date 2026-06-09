import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { ensureOwner } from "@/lib/owners";
import { monthlyUsage } from "@/lib/api-keys/service";
import { isStripeConfigured } from "@/lib/billing/stripe";
import { quotaForPlan } from "@/lib/billing/plans";
import { BillingPanel } from "./billing-panel";

export default async function BillingPage() {
  const owner = await ensureOwner();
  const plan = owner?.planTier ?? "free";
  const used = owner ? await monthlyUsage(owner.id) : 0;
  const quota = quotaForPlan(plan);

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
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">Billing</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          You charge the verifier — your plan sets the monthly verify-call quota.
        </p>

        <div className="mt-6 rounded-lg border border-border p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Current plan
          </p>
          <p className="mt-1 font-mono text-sm capitalize">{plan}</p>
          <p className="mt-2 text-xs uppercase tracking-wide text-muted-foreground">
            Verify calls this month
          </p>
          <p className="mt-1 font-mono text-sm">
            {used.toLocaleString()} / {quota.toLocaleString()}
          </p>
        </div>

        <div className="mt-8">
          <BillingPanel currentPlan={plan} configured={isStripeConfigured()} />
        </div>
      </main>
    </div>
  );
}
