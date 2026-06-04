"use client";

import { useActionState } from "react";
import {
  createWebhookAction,
  toggleWebhookAction,
  type WebhookActionState,
} from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type WebhookRow = {
  id: string;
  url: string;
  active: boolean;
  createdAt: Date | string;
  lastDeliveryAt: Date | string | null;
  lastStatus: string | null;
};

function CreateWebhook() {
  const [state, action, pending] = useActionState<WebhookActionState, FormData>(
    createWebhookAction,
    null,
  );
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Add a webhook</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <form action={action} className="flex items-end gap-2">
          <div className="flex flex-1 flex-col gap-1.5">
            <label htmlFor="url" className="text-sm font-medium">
              HTTPS endpoint URL
            </label>
            <Input id="url" name="url" placeholder="https://example.com/hooks/passportforagents" />
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? "Adding…" : "Add"}
          </Button>
        </form>
        {state?.secret && (
          <div className="rounded-md border border-warning/40 bg-warning/10 p-3">
            <p className="text-xs font-medium text-warning">
              Signing secret — copy now, shown once. Verify the{" "}
              <code className="font-mono">x-passportforagents-signature</code> header with it.
            </p>
            <pre className="mt-2 overflow-x-auto font-mono text-xs">{state.secret}</pre>
          </div>
        )}
        {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      </CardContent>
    </Card>
  );
}

function ToggleButton({ id, active }: { id: string; active: boolean }) {
  const [, action, pending] = useActionState<WebhookActionState, FormData>(
    toggleWebhookAction,
    null,
  );
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="active" value={(!active).toString()} />
      <Button type="submit" variant="ghost" size="sm" disabled={pending}>
        {pending ? "…" : active ? "Disable" : "Enable"}
      </Button>
    </form>
  );
}

export function WebhooksManager({ webhooks }: { webhooks: WebhookRow[] }) {
  return (
    <div className="flex flex-col gap-6">
      <CreateWebhook />
      {webhooks.length > 0 && (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {webhooks.map((w) => (
            <li key={w.id} className="flex items-center justify-between gap-4 p-4">
              <div className="min-w-0">
                <p className="truncate font-mono text-sm">
                  {w.url}
                  {!w.active && (
                    <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                      disabled
                    </span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  {w.lastDeliveryAt
                    ? `last: ${w.lastStatus} @ ${new Date(w.lastDeliveryAt).toISOString().slice(0, 16).replace("T", " ")}`
                    : "no deliveries yet"}
                </p>
              </div>
              <ToggleButton id={w.id} active={w.active} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
