"use client";

import { useActionState } from "react";
import {
  verifyDnsAction,
  verifyWellKnownAction,
  type ActionState,
} from "../actions";
import { Button } from "@/components/ui/button";

function Result({ state }: { state: ActionState }) {
  if (!state) return null;
  if (state.error)
    return <p className="mt-2 text-sm text-destructive">{state.error}</p>;
  if (state.ok) return <p className="mt-2 text-sm text-success">{state.ok}</p>;
  return null;
}

export function WellKnownVerify({ agentId }: { agentId: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    verifyWellKnownAction,
    null,
  );
  return (
    <form action={action}>
      <input type="hidden" name="agentId" value={agentId} />
      <Button type="submit" disabled={pending} size="sm">
        {pending ? "Checking…" : "Verify .well-known"}
      </Button>
      <Result state={state} />
    </form>
  );
}

export function DnsVerify({ agentId }: { agentId: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    verifyDnsAction,
    null,
  );
  return (
    <form action={action}>
      <input type="hidden" name="agentId" value={agentId} />
      <Button type="submit" disabled={pending} size="sm" variant="outline">
        {pending ? "Checking…" : "Verify DNS TXT"}
      </Button>
      <Result state={state} />
    </form>
  );
}
