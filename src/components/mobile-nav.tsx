"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

/** Hamburger menu for the homepage header on < sm viewports. Clerk-free (auth
 *  is plain links) so public pages ship no auth SDK; touch targets >= 44px. */
export function MobileNav() {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return (
    <div className="sm:hidden">
      <button
        type="button"
        aria-label="Toggle menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-border text-lg text-foreground"
      >
        <span aria-hidden>{open ? "✕" : "☰"}</span>
      </button>
      {open && (
        <div className="absolute inset-x-0 top-14 z-50 border-b border-border bg-background">
          <nav className="mx-auto flex max-w-5xl flex-col gap-1 px-6 py-3 text-sm">
            <Link href="/registry" onClick={close} className="py-3 hover:underline">
              Registry
            </Link>
            <Link href="/docs" onClick={close} className="py-3 hover:underline">
              Docs
            </Link>
            <Link href="/spec" onClick={close} className="py-3 hover:underline">
              Spec
            </Link>
            <Link href="/sign-in" onClick={close} className="py-3 hover:underline">
              Sign in
            </Link>
            <Button asChild size="sm" className="mt-1 h-11 w-fit px-5">
              <Link href="/sign-up" onClick={close}>
                Get started
              </Link>
            </Button>
          </nav>
        </div>
      )}
    </div>
  );
}
