"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

const TIERS = [
  { tier: "pro", label: "Pro", price: "$29/mo", calls: "25,000 calls/mo" },
  { tier: "team", label: "Team", price: "$99/mo", calls: "100,000 calls/mo" },
  { tier: "business", label: "Business", price: "$199/mo", calls: "250,000 calls/mo" },
] as const;

export function BillingPanel({
  currentPlan,
  configured,
}: {
  currentPlan: string;
  configured: boolean;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function post(path: string, body?: unknown) {
    setBusy(path + (body ? JSON.stringify(body) : ""));
    setError(null);
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        setError(data.error ?? "Something went wrong");
        return;
      }
      window.location.assign(data.url);
    } catch {
      setError("Network error");
    } finally {
      setBusy(null);
    }
  }

  const isPaid = currentPlan !== "free";

  return (
    <div className="flex flex-col gap-4">
      {!configured && (
        <p className="rounded-md border border-warning/40 bg-warning/10 p-3 text-sm text-warning">
          Billing isn&apos;t configured yet (no Stripe keys). Plans are shown for
          reference; checkout activates once Stripe is connected.
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        {TIERS.map((t) => (
          <div key={t.tier} className="rounded-lg border border-border p-4">
            <p className="font-semibold">{t.label}</p>
            <p className="font-mono text-sm">{t.price}</p>
            <p className="mt-1 text-xs text-muted-foreground">{t.calls}</p>
            <Button
              className="mt-3 w-full"
              size="sm"
              disabled={!configured || currentPlan === t.tier || busy !== null}
              onClick={() => post("/api/billing/checkout", { tier: t.tier })}
            >
              {currentPlan === t.tier ? "Current plan" : `Upgrade to ${t.label}`}
            </Button>
          </div>
        ))}
      </div>
      {isPaid && (
        <Button
          variant="outline"
          className="self-start"
          disabled={!configured || busy !== null}
          onClick={() => post("/api/billing/portal")}
        >
          Manage subscription
        </Button>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
