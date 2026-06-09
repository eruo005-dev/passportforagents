import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SiteFooter } from "@/components/site-footer";
import { MobileNav } from "@/components/mobile-nav";
import type { Metadata } from "next";

export const metadata: Metadata = { alternates: { canonical: "/" } };

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen">
      <header className="relative border-b border-border">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
          <Link href="/" className="font-mono text-sm font-semibold tracking-tight">
            passport<span className="text-muted-foreground">foragents</span>
          </Link>
          <nav className="hidden items-center gap-3 sm:flex">
            <Button asChild variant="ghost" size="sm">
              <Link href="/registry">Registry</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/docs">Docs</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/sign-in">Sign in</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/sign-up">Get started</Link>
            </Button>
          </nav>
          <MobileNav />
        </div>
      </header>

      <main id="main" className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-6 py-24">
        <p className="mb-4 font-mono text-xs uppercase tracking-widest text-muted-foreground">
          verified-agent badge · trust API · public registry
        </p>
        <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
          Is this agent who it claims to be — and is it any good?
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
          PassportForAgents answers both in one API call. Identity from domain
          control + an Ed25519-signed{" "}
          <code className="font-mono text-sm text-foreground">
            .well-known/agent-passport.json
          </code>{" "}
          — no blockchain, no DID, no enterprise sales. Built for the open MCP
          ecosystem.
        </p>
        <div className="mt-10 flex flex-wrap gap-3">
          <Button asChild size="lg" className="h-11">
            <Link href="/sign-up">Get started</Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="h-11">
            <Link href="/spec">Read the open spec</Link>
          </Button>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
