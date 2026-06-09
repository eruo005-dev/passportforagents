"use client";

import { useActionState } from "react";
import { registerSubAgentAction, type ActionState } from "./agents/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export type VerifiedDomain = { id: string; domain: string; status: string };

export function RegisterSubAgent({ domains }: { domains: VerifiedDomain[] }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    registerSubAgentAction,
    null,
  );
  if (domains.length === 0) return null;

  return (
    <Card className="mt-8">
      <CardHeader>
        <CardTitle className="text-base">Register an agent under a verified domain</CardTitle>
        <CardDescription>
          Verify a domain once, then give each agent it operates its own identity —
          a stable Agent ID, profile, badge, and trust score.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="domainId" className="text-sm font-medium">Domain</label>
            <select
              id="domainId"
              name="domainId"
              className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
            >
              {domains.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.domain} ({d.status})
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-1 flex-col gap-1.5">
            <label htmlFor="name" className="text-sm font-medium">Agent name</label>
            <Input id="name" name="name" placeholder="The Ethicist" required />
          </div>
          <div className="flex flex-1 flex-col gap-1.5">
            <label htmlFor="capabilities" className="text-sm font-medium">
              Capabilities <span className="text-muted-foreground">(comma-sep)</span>
            </label>
            <Input id="capabilities" name="capabilities" placeholder="debate, ethics" />
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? "Adding…" : "Add agent"}
          </Button>
        </form>
        {state?.error && <p className="mt-2 text-sm text-destructive">{state.error}</p>}
      </CardContent>
    </Card>
  );
}
