import Link from "next/link";
import { Show, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { SiteFooter } from "@/components/site-footer";
import { MobileNav } from "@/components/mobile-nav";

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
            <Show when="signed-out">
              <SignInButton mode="modal">
                <Button variant="ghost" size="sm">
                  Sign in
                </Button>
              </SignInButton>
              <SignUpButton mode="modal">
                <Button size="sm">Get started</Button>
              </SignUpButton>
            </Show>
            <Show when="signed-in">
              <Button asChild variant="ghost" size="sm">
                <Link href="/dashboard">Dashboard</Link>
              </Button>
              <UserButton />
            </Show>
          </nav>
          <MobileNav />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-6 py-24">
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
          <Show when="signed-out">
            <SignUpButton mode="modal">
              <Button size="lg">Get started</Button>
            </SignUpButton>
          </Show>
          <Show when="signed-in">
            <Button asChild size="lg">
              <Link href="/dashboard">Go to dashboard</Link>
            </Button>
          </Show>
          <Button asChild variant="outline" size="lg">
            <Link href="/spec">Read the open spec</Link>
          </Button>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
