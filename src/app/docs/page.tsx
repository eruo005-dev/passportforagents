import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Docs — PassportForAgents",
  description:
    "Developer docs: the open agent-passport spec, the Verify API, the trust score, and the zero-dependency verify-before-connect SDK.",
};

function Code({ children }: { children: string }) {
  return (
    <pre className="mt-3 overflow-x-auto rounded-md border border-border bg-muted/40 p-3 font-mono text-xs leading-relaxed">
      {children}
    </pre>
  );
}

const SECTIONS = [
  ["spec", "The open spec"],
  ["verify-api", "Verify API"],
  ["trust-score", "Trust score"],
  ["sdk", "SDK — verify before connect"],
  ["badge", "Embeddable badge"],
] as const;

export default function DocsPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-border">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
          <Link href="/" className="font-mono text-sm font-semibold tracking-tight">
            passport<span className="text-muted-foreground">foragents</span>
          </Link>
          <nav className="flex gap-4 text-xs text-muted-foreground">
            <Link href="/registry" className="hover:underline">Registry</Link>
            <Link href="/spec" className="hover:underline">Spec page</Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
        <h1 className="text-3xl font-semibold tracking-tight">Developer docs</h1>
        <p className="mt-2 text-muted-foreground">
          Verify that an agent is who it claims to be — and how trustworthy it is —
          in one API call, or fully locally with the open spec.
        </p>
        <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {SECTIONS.map(([id, label]) => (
            <li key={id}>
              <a href={`#${id}`} className="text-muted-foreground hover:underline">{label}</a>
            </li>
          ))}
        </ul>

        <section id="spec" className="mt-12 scroll-mt-20">
          <h2 className="text-xl font-semibold tracking-tight">The open spec</h2>
          <p className="mt-2 text-muted-foreground">
            An agent proves identity by serving an Ed25519-signed JSON document at{" "}
            <code className="font-mono text-foreground">/.well-known/agent-passport.json</code>{" "}
            on the domain it controls. Verification = fetch over HTTPS, canonicalize
            the body (RFC 8785 JCS), verify the detached signature against the
            declared public key, and confirm the serving host matches{" "}
            <code className="font-mono text-foreground">owner_domain</code>. No
            blockchain, no DID, no central authority. Full spec:{" "}
            <Link href="/spec" className="underline">/spec</Link>.
          </p>
        </section>

        <section id="verify-api" className="mt-12 scroll-mt-20">
          <h2 className="text-xl font-semibold tracking-tight">Verify API</h2>
          <p className="mt-2 text-muted-foreground">
            <code className="font-mono text-foreground">GET /api/v1/verify?agent=&lt;slug-or-domain&gt;</code>{" "}
            — returns identity, verification status, and trust score. API-key auth;
            metered per call against your plan quota. <strong>Always check the{" "}
            <code className="font-mono">verified</code> boolean</strong> — resolution
            does not imply verification.
          </p>
          <Code>{`curl -H "Authorization: Bearer ap_live_xxx" \\
  "https://passportforagents.com/api/v1/verify?agent=acme-mcp-acme-dev"

# 200
{
  "agent": { "slug": "...", "name": "...", "owner_domain": "acme.dev",
             "public_key": "z6Mk...", "capabilities": ["tools/list"] },
  "status": "key_verified",
  "verified": true,
  "trust": { "score": 70, "breakdown": [ /* per-signal */ ] }
}`}</Code>
          <p className="mt-3 text-sm text-muted-foreground">
            Codes: 200 ok · 400 missing <code className="font-mono">agent</code> ·
            401 bad key · 404 unknown agent · 429 quota exceeded. Create keys in the{" "}
            <Link href="/dashboard/api-keys" className="underline">dashboard</Link>.
          </p>
        </section>

        <section id="trust-score" className="mt-12 scroll-mt-20">
          <h2 className="text-xl font-semibold tracking-tight">Trust score</h2>
          <p className="mt-2 text-muted-foreground">
            A transparent 0–100 weighted sum of independently verified signals —
            never a black box. Self-asserted claims carry zero weight until checked.
          </p>
          <Code>{`score = round( 100 * Σ ( value[signal] * weight[signal] ) )

domain_control 0.30 · signed_provenance 0.20 · secret_hygiene 0.20
uptime 0.10 · registry_presence 0.10 · user_rating 0.10`}</Code>
        </section>

        <section id="sdk" className="mt-12 scroll-mt-20">
          <h2 className="text-xl font-semibold tracking-tight">SDK — verify before connect</h2>
          <p className="mt-2 text-muted-foreground">
            <code className="font-mono text-foreground">@passportforagents/verify</code> —
            zero dependencies (platform WebCrypto). Verify fully locally, or via the
            hosted API.
          </p>
          <Code>{`import { verifyStandalone } from "@passportforagents/verify";

// Gateway pattern: refuse to connect to an unverified agent.
const r = await verifyStandalone("example.com");
if (!r.valid) throw new Error("unverified agent");
console.log(r.document?.agent_name, r.document?.capabilities);

// Or hosted: identity + status + trust score in one call.
import { verifyHosted } from "@passportforagents/verify";
const h = await verifyHosted({ agent: "acme-mcp-acme-dev", apiKey: process.env.PFA_KEY! });
if (h.ok && h.verified) console.log(h.trust?.score);`}</Code>
        </section>

        <section id="badge" className="mt-12 scroll-mt-20">
          <h2 className="text-xl font-semibold tracking-tight">Embeddable badge</h2>
          <p className="mt-2 text-muted-foreground">
            A live, cacheable SVG that reflects current status + score and links back
            to the public profile. Unspoofable (it&apos;s a live lookup). Drop it in
            your README:
          </p>
          <Code>{`[![PassportForAgents](https://passportforagents.com/agent/<slug>/badge)](https://passportforagents.com/agent/<slug>)`}</Code>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex h-12 max-w-3xl items-center px-6 text-xs text-muted-foreground">
          MIT-licensed open spec · domain control + Ed25519 = identity
        </div>
      </footer>
    </div>
  );
}
