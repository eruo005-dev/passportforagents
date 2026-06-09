import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = {
  title: "About",
  description:
    "PassportForAgents — the verified-agent badge, trust API, and public registry for the open MCP ecosystem.",
};

export default function AboutPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-6 py-16">
        <h1 className="text-3xl font-semibold tracking-tight">
          About PassportForAgents
        </h1>
        <p className="mt-6 text-muted-foreground">
          PassportForAgents answers one question about any AI agent in a single
          API call:{" "}
          <span className="text-foreground">
            is this agent who it claims to be, and is it any good?
          </span>
        </p>
        <p className="mt-4 text-muted-foreground">
          Identity comes from the same trust model that already secures the web —
          control of a domain plus a valid cryptographic signature. An operator
          publishes an Ed25519-signed document at{" "}
          <code className="font-mono text-foreground">
            /.well-known/agent-passport.json
          </code>{" "}
          on a domain they control. Anyone can verify it with no blockchain, no
          DID, and no dependence on our service.
        </p>
        <p className="mt-4 text-muted-foreground">
          On top of that open primitive we add a transparent, independently
          recomputable trust score and a public registry. The specification is
          MIT-licensed and the reference verifier is open — the hosted service is
          a convenience and reputation layer, never a requirement to verify.
        </p>
        <h2 className="mt-10 text-xl font-semibold tracking-tight">Contact</h2>
        <p className="mt-3 text-muted-foreground">
          Questions, partnerships, or security reports:{" "}
          <a
            className="text-foreground hover:underline"
            href="mailto:hello@passportforagents.com"
          >
            hello@passportforagents.com
          </a>
          .
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
