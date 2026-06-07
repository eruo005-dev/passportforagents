import Link from "next/link";

/** Shared content-page header (logo + primary nav). */
export function SiteHeader() {
  return (
    <header className="border-b border-border">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
        <Link
          href="/"
          className="font-mono text-sm font-semibold tracking-tight"
        >
          passport<span className="text-muted-foreground">foragents</span>
        </Link>
        <nav className="flex gap-4 text-xs text-muted-foreground">
          <Link href="/registry" className="hover:underline">
            Registry
          </Link>
          <Link href="/docs" className="hover:underline">
            Docs
          </Link>
          <Link href="/spec" className="hover:underline">
            Spec
          </Link>
        </nav>
      </div>
    </header>
  );
}
