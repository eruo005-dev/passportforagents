"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

/** Dark-themed error boundary (replaces Next's default white error screen). */
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface in monitoring/console; never render internals to the user.
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 py-24 text-center">
      <p className="font-mono text-sm text-muted-foreground">500</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">
        Something went wrong
      </h1>
      <p className="mt-3 max-w-md text-muted-foreground">
        An unexpected error occurred. It has been logged
        {error.digest ? (
          <> (ref <code className="font-mono text-foreground">{error.digest}</code>)</>
        ) : null}
        .
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button size="lg" onClick={() => reset()}>
          Try again
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link href="/">Back home</Link>
        </Button>
      </div>
    </div>
  );
}
