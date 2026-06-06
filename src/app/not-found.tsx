import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Page not found" };

/** Dark-themed 404 with navigation back into the site (replaces the default). */
export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col">
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

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-6 py-24 text-center">
        <p className="font-mono text-sm text-muted-foreground">404</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Page not found
        </h1>
        <p className="mt-3 max-w-md text-muted-foreground">
          That page does not exist — it may have moved, or the link was mistyped.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button asChild size="lg">
            <Link href="/">Back home</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/registry">Browse the registry</Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
