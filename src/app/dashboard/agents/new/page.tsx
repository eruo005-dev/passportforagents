"use client";

import Link from "next/link";
import { useActionState } from "react";
import { claimAgentAction, type ActionState } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function NewAgentPage() {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    claimAgentAction,
    null,
  );

  return (
    <div className="mx-auto w-full max-w-xl px-6 py-12">
      <Link href="/dashboard" className="font-mono text-xs text-muted-foreground">
        ← dashboard
      </Link>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">
        Claim an MCP server
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Claiming is free. You&apos;ll prove control of the domain in the next
        step.
      </p>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Server details</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="name" className="text-sm font-medium">
                Name
              </label>
              <Input id="name" name="name" placeholder="Acme MCP Server" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="domain" className="text-sm font-medium">
                Domain
              </label>
              <Input id="domain" name="domain" placeholder="example.com" required />
              <p className="text-xs text-muted-foreground">
                The domain you control and will publish the passport on.
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="description" className="text-sm font-medium">
                Description <span className="text-muted-foreground">(optional)</span>
              </label>
              <Input
                id="description"
                name="description"
                placeholder="What this MCP server does"
              />
            </div>

            {state?.error && (
              <p className="text-sm text-destructive">{state.error}</p>
            )}

            <Button type="submit" disabled={pending} className="mt-2 self-start">
              {pending ? "Claiming…" : "Claim server"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
