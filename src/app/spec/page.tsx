import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { SPEC_VERSION } from "@/lib/passport/types";

export const metadata: Metadata = {
  title: "Spec",
  description:
    "The open, MIT-licensed Agent Passport specification: domain control + Ed25519 signatures = self-verifiable agent identity.",
};

export default function SpecPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-16">
        <h1 className="text-3xl font-semibold tracking-tight">
          The Agent Passport spec
        </h1>
        <p className="mt-2 font-mono text-xs text-muted-foreground">
          spec_version {SPEC_VERSION} · MIT-licensed
        </p>

        <p className="mt-6 text-muted-foreground">
          An agent proves its identity by serving a signed JSON document at a
          fixed path on the domain it controls:
        </p>
        <pre className="mt-4 overflow-x-auto rounded-lg border border-border bg-card p-4 font-mono text-sm">
          https://&lt;your-domain&gt;/.well-known/agent-passport.json
        </pre>

        <p className="mt-6 text-muted-foreground">
          Verification = fetch the file over HTTPS from the claimed domain,
          canonicalize the body (RFC 8785 JCS), verify the detached Ed25519
          signature against the declared public key, and confirm the serving host
          matches{" "}
          <code className="font-mono text-foreground">owner_domain</code>. Control
          of the domain + a valid signature = identity. No blockchain, no DID, no
          central authority required to verify.
        </p>

        <p className="mt-6 text-muted-foreground">
          The full normative spec lives in{" "}
          <code className="font-mono text-foreground">SPEC.md</code> in the repo,
          alongside a zero-dependency reference verifier you can run against any
          domain without our hosted service.
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
