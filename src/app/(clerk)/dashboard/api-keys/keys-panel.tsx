"use client";

import { useActionState } from "react";
import { createKeyAction, revokeKeyAction, type KeyActionState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type KeyRow = {
  id: string;
  keyPrefix: string;
  label: string | null;
  createdAt: Date | string;
  lastUsedAt: Date | string | null;
  revokedAt: Date | string | null;
};

function CreateKey() {
  const [state, action, pending] = useActionState<KeyActionState, FormData>(
    createKeyAction,
    null,
  );
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Create an API key</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <form action={action} className="flex items-end gap-2">
          <div className="flex flex-1 flex-col gap-1.5">
            <label htmlFor="label" className="text-sm font-medium">
              Label <span className="text-muted-foreground">(optional)</span>
            </label>
            <Input id="label" name="label" placeholder="prod-gateway" />
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? "Creating…" : "Create key"}
          </Button>
        </form>
        {state?.plaintext && (
          <div className="rounded-md border border-warning/40 bg-warning/10 p-3">
            <p className="text-xs font-medium text-warning">
              Copy this now — it is shown once and cannot be recovered.
            </p>
            <pre className="mt-2 overflow-x-auto font-mono text-xs">{state.plaintext}</pre>
          </div>
        )}
        {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      </CardContent>
    </Card>
  );
}

function RevokeButton({ id }: { id: string }) {
  const [, action, pending] = useActionState<KeyActionState, FormData>(
    revokeKeyAction,
    null,
  );
  return (
    <form action={action}>
      <input type="hidden" name="keyId" value={id} />
      <Button type="submit" variant="ghost" size="sm" disabled={pending}>
        {pending ? "…" : "Revoke"}
      </Button>
    </form>
  );
}

export function KeysManager({ keys }: { keys: KeyRow[] }) {
  return (
    <div className="flex flex-col gap-6">
      <CreateKey />
      {keys.length > 0 && (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {keys.map((k) => (
            <li key={k.id} className="flex items-center justify-between gap-4 p-4">
              <div className="min-w-0">
                <p className="font-mono text-sm">
                  {k.keyPrefix}
                  {k.label ? <span className="ml-2 text-muted-foreground">{k.label}</span> : null}
                  {k.revokedAt ? (
                    <span className="ml-2 rounded bg-destructive/10 px-1.5 py-0.5 text-xs text-destructive">
                      revoked
                    </span>
                  ) : null}
                </p>
                <p className="text-xs text-muted-foreground">
                  Created {new Date(k.createdAt).toISOString().slice(0, 10)}
                  {k.lastUsedAt
                    ? ` · last used ${new Date(k.lastUsedAt).toISOString().slice(0, 10)}`
                    : " · never used"}
                </p>
              </div>
              {!k.revokedAt && <RevokeButton id={k.id} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
