import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How PassportForAgents collects, uses, and protects your data.",
};

export default function PrivacyPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main id="main" className="mx-auto w-full max-w-3xl flex-1 space-y-4 px-6 py-16 text-muted-foreground">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Privacy Policy
        </h1>
        <p className="rounded-md border border-border bg-card p-3 text-xs">
          PassportForAgents is a free, open beta. This policy describes our actual
          data practices in plain terms; the hosted service is provided as-is (see
          the Terms). We will expand it before any future commercial offering.
        </p>
        <p className="font-mono text-xs">Last updated: 2026-06-07</p>

        <h2 className="pt-4 text-xl font-semibold text-foreground">
          What we collect
        </h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Account information you provide via our authentication provider (your
            email address, and any name you supply).
          </li>
          <li>API keys we issue to you (stored hashed, never in plaintext).</li>
          <li>
            Agent and domain data you submit for verification (domains, public
            keys, capabilities, passport documents).
          </li>
          <li>
            Basic operational logs (timestamps, request metadata) needed to run
            and secure the service.
          </li>
        </ul>

        <h2 className="pt-4 text-xl font-semibold text-foreground">
          What we do not do
        </h2>
        <p>
          We do not sell your data, run third-party advertising, or load
          third-party tracking or analytics. Authentication is the only embedded
          third-party dependency.
        </p>

        <h2 className="pt-4 text-xl font-semibold text-foreground">
          Processors &amp; where data lives
        </h2>
        <p>
          We use a small set of infrastructure providers acting as processors on
          our behalf, each handling data only to run the service:
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <span className="text-foreground">Clerk</span> — authentication (your
            email and session).
          </li>
          <li>
            <span className="text-foreground">Supabase</span> — managed Postgres
            (accounts, hashed API keys, verification records).
          </li>
          <li>
            <span className="text-foreground">Vercel</span> — hosting and CDN.
          </li>
        </ul>
        <p>
          These providers operate in the United States, so your data may be
          processed there. For EU/UK users, our lawful basis is the legitimate
          interest in providing the service you signed up for (and consent for any
          optional features). We retain account data only while your account is
          active, plus a short window for security logs; public registry entries
          you publish stay public until you remove them. Request access or
          deletion any time via the contact below.
        </p>

        <h2 className="pt-4 text-xl font-semibold text-foreground">Cookies</h2>
        <p>
          We use essential cookies set by our authentication provider to keep you
          signed in. We do not use advertising or cross-site tracking cookies.
        </p>

        <h2 className="pt-4 text-xl font-semibold text-foreground">Your rights</h2>
        <p>
          You may request access to, correction of, or deletion of your account
          data by contacting us. Verification records you publish to the public
          registry are, by design, public.
        </p>

        <h2 className="pt-4 text-xl font-semibold text-foreground">Contact</h2>
        <p>
          <a
            className="text-foreground hover:underline"
            href="mailto:privacy@passportforagents.com"
          >
            privacy@passportforagents.com
          </a>
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
