"use client";

import { useState } from "react";
import Link from "next/link";
import { Show, SignInButton, SignUpButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";

/** Hamburger menu for the homepage header on < sm viewports (fixes the nav
 *  overflow on mobile). The full nav stays inline on >= sm. */
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
        className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border text-lg text-foreground"
      >
        <span aria-hidden>{open ? "✕" : "☰"}</span>
      </button>
      {open && (
        <div className="absolute inset-x-0 top-14 z-50 border-b border-border bg-background">
          <nav className="mx-auto flex max-w-5xl flex-col gap-1 px-6 py-3 text-sm">
            <Link href="/registry" onClick={close} className="py-2 hover:underline">
              Registry
            </Link>
            <Link href="/docs" onClick={close} className="py-2 hover:underline">
              Docs
            </Link>
            <Link href="/spec" onClick={close} className="py-2 hover:underline">
              Spec
            </Link>
            <Show when="signed-out">
              <SignInButton mode="modal">
                <button type="button" className="py-2 text-left hover:underline">
                  Sign in
                </button>
              </SignInButton>
              <SignUpButton mode="modal">
                <Button size="sm" className="mt-1 w-fit">
                  Get started
                </Button>
              </SignUpButton>
            </Show>
            <Show when="signed-in">
              <Link href="/dashboard" onClick={close} className="py-2 hover:underline">
                Dashboard
              </Link>
            </Show>
          </nav>
        </div>
      )}
    </div>
  );
}
