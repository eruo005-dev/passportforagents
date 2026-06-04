import Link from "next/link";
import { Show, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen">
      <header className="border-b border-border">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
          <Link href="/" className="font-mono text-sm font-semibold tracking-tight">
            agent<span className="text-muted-foreground">passport</span>
          </Link>
          <nav className="flex items-center gap-3">
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
          AgentPassport answers both in one API call. Identity from domain
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
              <Button size="lg">Verify your MCP server</Button>
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

      <footer className="border-t border-border">
        <div className="mx-auto flex h-12 max-w-5xl items-center px-6 text-xs text-muted-foreground">
          MIT-licensed open spec · domain control + Ed25519 = identity
        </div>
      </footer>
    </div>
  );
}
