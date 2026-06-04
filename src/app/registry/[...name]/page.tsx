import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getRegistryEntry } from "@/lib/registry/ingest";
import { jsonLdScript } from "@/lib/jsonld";
import { Button } from "@/components/ui/button";

/** Decode catch-all segments; returns null on malformed percent-encoding. */
function decodeName(parts: string[]): string | null {
  try {
    return parts.map(decodeURIComponent).join("/");
  } catch {
    return null;
  }
}

function encodeName(name: string): string {
  return name.split("/").map(encodeURIComponent).join("/");
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ name: string[] }>;
}): Promise<Metadata> {
  const { name } = await params;
  const decoded = decodeName(name);
  const entry = decoded ? await getRegistryEntry(decoded) : null;
  if (!entry) return { title: "Server not found — PassportForAgents" };
  return {
    title: `${entry.name} — MCP Registry — PassportForAgents`,
    description: entry.description ?? `MCP server ${entry.name}`,
  };
}

export default async function RegistryDetailPage({
  params,
}: {
  params: Promise<{ name: string[] }>;
}) {
  const { name } = await params;
  const decoded = decodeName(name);
  const entry = decoded ? await getRegistryEntry(decoded) : null;
  if (!entry) notFound();

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://passportforagents.com";
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: entry.name,
    applicationCategory: "DeveloperApplication",
    operatingSystem: "Model Context Protocol",
    url: `${appUrl}/registry/${encodeName(entry.name)}`,
    ...(entry.description ? { description: entry.description } : {}),
    ...(entry.repoUrl ? { codeRepository: entry.repoUrl } : {}),
    ...(entry.version ? { softwareVersion: entry.version } : {}),
  };

  return (
    <div className="flex min-h-screen flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }}
      />
      <header className="border-b border-border">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-6">
          <Link href="/" className="font-mono text-sm font-semibold tracking-tight">
            passport<span className="text-muted-foreground">foragents</span>
          </Link>
          <Link href="/registry" className="text-xs text-muted-foreground hover:underline">
            ← registry
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
        <h1 className="break-all text-2xl font-semibold tracking-tight">{entry.name}</h1>
        {entry.version && (
          <p className="mt-1 font-mono text-xs text-muted-foreground">v{entry.version}</p>
        )}
        {entry.description && <p className="mt-4 text-muted-foreground">{entry.description}</p>}

        <dl className="mt-6 space-y-2 text-sm">
          {entry.repoUrl && (
            <div>
              <span className="text-muted-foreground">Repository: </span>
              <a href={entry.repoUrl} rel="nofollow noopener" className="underline">
                {entry.repoUrl}
              </a>
            </div>
          )}
          {entry.websiteUrl && (
            <div>
              <span className="text-muted-foreground">Website: </span>
              <a href={entry.websiteUrl} rel="nofollow noopener" className="underline">
                {entry.websiteUrl}
              </a>
            </div>
          )}
          <div>
            <span className="text-muted-foreground">Source: </span>
            <span className="font-mono text-xs">official MCP Registry</span>
          </div>
        </dl>

        <div className="mt-8 rounded-lg border border-border bg-card p-5">
          <p className="text-sm font-medium">Is this your server?</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Claim it and prove control of its domain to earn a verified badge and a
            transparent trust score.
          </p>
          <Button asChild className="mt-3">
            <Link href="/dashboard/agents/new">Claim &amp; verify</Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
