import Link from "next/link";

/** Shared site footer with product + company links. Responsive: stacks on
 *  mobile, row on >=sm. Carries the legal links site-wide. */
export function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-5xl flex-col gap-4 px-6 py-8 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p className="font-mono">
          passport<span className="text-foreground">foragents</span> · domain
          control + Ed25519 = identity
        </p>
        <nav className="flex flex-wrap gap-x-4 gap-y-2">
          <Link href="/registry" className="hover:underline">
            Registry
          </Link>
          <Link href="/docs" className="hover:underline">
            Docs
          </Link>
          <Link href="/spec" className="hover:underline">
            Spec
          </Link>
          <Link href="/pricing" className="hover:underline">
            Pricing
          </Link>
          <Link href="/about" className="hover:underline">
            About
          </Link>
          <Link href="/privacy" className="hover:underline">
            Privacy
          </Link>
          <Link href="/terms" className="hover:underline">
            Terms
          </Link>
        </nav>
      </div>
    </footer>
  );
}
