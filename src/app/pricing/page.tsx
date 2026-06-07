import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "PassportForAgents is free during open beta — and the spec + reference verifier are open-source (MIT). No card required.",
};

export default function PricingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-16">
        <h1 className="text-3xl font-semibold tracking-tight">Pricing</h1>
        <p className="mt-3 text-muted-foreground">
          PassportForAgents is{" "}
          <span className="text-foreground">free during open beta</span> — no
          credit card, no paywall. The Agent Passport spec and the reference
          verifier are MIT-licensed and self-verifiable, so you never need our
          hosted service to verify a passport.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-border bg-card p-5">
            <h2 className="font-semibold text-foreground">
              Open spec — free forever
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              The MIT-licensed format plus a zero-dependency reference verifier.
              Verify any passport offline with no dependence on us, and self-host
              the whole thing.
            </p>
            <Button asChild variant="outline" size="sm" className="mt-4">
              <Link href="/spec">Read the spec</Link>
            </Button>
          </div>
          <div className="rounded-lg border border-border bg-card p-5">
            <h2 className="font-semibold text-foreground">
              Hosted service — free in beta
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              The convenience layer: verification API, trust score, public
              registry, and signed attestations. Free while we grow — generous
              quotas, no card required.
            </p>
            <Button asChild size="sm" className="mt-4">
              <Link href="/docs">Get started</Link>
            </Button>
          </div>
        </div>

        <p className="mt-8 text-sm text-muted-foreground">
          If we ever introduce paid tiers, the open spec and offline verification
          stay free — you would only pay for hosted convenience at scale
          (freshness, batch verification, registry tooling), and we will announce
          any pricing well in advance.
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
