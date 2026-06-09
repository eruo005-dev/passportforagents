import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The terms governing use of PassportForAgents.",
};

export default function TermsPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main id="main" className="mx-auto w-full max-w-3xl flex-1 space-y-4 px-6 py-16 text-muted-foreground">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Terms of Service
        </h1>
        <p className="rounded-md border border-border bg-card p-3 text-xs">
          PassportForAgents is a free, open beta, provided as-is with no warranty.
          The open spec and reference verifier are MIT-licensed (see the repo);
          these terms govern the hosted service.
        </p>
        <p className="font-mono text-xs">Last updated: 2026-06-07</p>

        <h2 className="pt-4 text-xl font-semibold text-foreground">
          The service
        </h2>
        <p>
          PassportForAgents provides agent identity verification, a trust score,
          and a public registry for the open MCP ecosystem. You may use it under
          these terms.
        </p>

        <h2 className="pt-4 text-xl font-semibold text-foreground">
          Accounts and acceptable use
        </h2>
        <p>
          You are responsible for activity under your account and API keys. Do not
          abuse, overload, or attempt to circumvent the service, and do not submit
          data you have no right to publish.
        </p>

        <h2 className="pt-4 text-xl font-semibold text-foreground">
          Verification is identity, not endorsement
        </h2>
        <p>
          A successful verification proves control of a domain and a valid
          signature over a self-asserted document. It is{" "}
          <span className="text-foreground">not</span> a guarantee of the safety,
          quality, security, or fitness of any agent. The trust score is a
          transparent, recomputable signal — not a warranty. Always exercise your
          own judgement before connecting to or relying on any agent.
        </p>

        <h2 className="pt-4 text-xl font-semibold text-foreground">
          The open spec
        </h2>
        <p>
          The Agent Passport specification and reference verifier are released
          under the MIT License. You may verify passports independently, with no
          dependence on this hosted service.
        </p>

        <h2 className="pt-4 text-xl font-semibold text-foreground">
          No warranty; limitation of liability
        </h2>
        <p>
          The service is provided on an “as is” basis, without warranties of any
          kind. To the maximum extent permitted by law, we are not liable for
          indirect or consequential damages arising from use of the service.
        </p>

        <h2 className="pt-4 text-xl font-semibold text-foreground">Changes</h2>
        <p>
          We may update these terms; material changes will be reflected by the
          date above.
        </p>

        <h2 className="pt-4 text-xl font-semibold text-foreground">Contact</h2>
        <p>
          <a
            className="text-foreground hover:underline"
            href="mailto:hello@passportforagents.com"
          >
            hello@passportforagents.com
          </a>
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
