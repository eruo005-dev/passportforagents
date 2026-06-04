import Link from "next/link";
import type { Metadata } from "next";
import { searchRegistry } from "@/lib/registry/ingest";
import { jsonLdScript } from "@/lib/jsonld";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "MCP Server Registry — PassportForAgents",
  description:
    "Search the open MCP server registry. See which servers are domain- and key-verified, with transparent trust scores.",
};

function encodeName(name: string): string {
  return name.split("/").map(encodeURIComponent).join("/");
}

export default async function RegistryPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string }>;
}) {
  const { search = "" } = await searchParams;
  const rows = await searchRegistry(search, 60);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "MCP Server Registry",
    numberOfItems: rows.length,
    itemListElement: rows.slice(0, 50).map((r, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${appUrl}/registry/${encodeName(r.name)}`,
      name: r.name,
    })),
  };

  return (
    <div className="flex min-h-screen flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }}
      />
      <header className="border-b border-border">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
          <Link href="/" className="font-mono text-sm font-semibold tracking-tight">
            passport<span className="text-muted-foreground">foragents</span>
          </Link>
          <Link href="/spec" className="text-xs text-muted-foreground hover:underline">
            How verification works
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
        <h1 className="text-3xl font-semibold tracking-tight">MCP Server Registry</h1>
        <p className="mt-2 text-muted-foreground">
          Mirrored from the official MCP Registry and enriched with
          PassportForAgents verification status.
        </p>

        <form className="mt-6 flex gap-2" action="/registry">
          <Input
            name="search"
            defaultValue={search}
            placeholder="Search by name or description…"
            className="flex-1"
          />
          <Button type="submit">Search</Button>
        </form>

        <p className="mt-4 text-xs text-muted-foreground">
          {rows.length} server{rows.length === 1 ? "" : "s"}
          {search ? ` matching “${search}”` : ""}
        </p>

        <ul className="mt-4 divide-y divide-border rounded-lg border border-border">
          {rows.length === 0 && (
            <li className="p-6 text-sm text-muted-foreground">No servers found.</li>
          )}
          {rows.map((r) => (
            <li key={r.name} className="flex items-start justify-between gap-4 p-4">
              <div className="min-w-0">
                <Link
                  href={`/registry/${encodeName(r.name)}`}
                  className="font-mono text-sm hover:underline"
                >
                  {r.name}
                </Link>
                {r.description && (
                  <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
                    {r.description}
                  </p>
                )}
              </div>
              <div className="shrink-0">
                {r.claimed ? (
                  <Link
                    href={`/agent/${r.claimedSlug}`}
                    className="inline-flex items-center gap-1.5 rounded-full border border-success/40 bg-success/10 px-2.5 py-0.5 text-xs font-medium text-success"
                  >
                    <span className="size-1.5 rounded-full bg-success" />
                    {r.claimedStatus === "key_verified" ? "Verified" : "Claimed"}
                  </Link>
                ) : (
                  <span className="text-xs text-muted-foreground">unclaimed</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
