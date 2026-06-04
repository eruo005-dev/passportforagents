import { ensureOwner } from "@/lib/owners";
import { createCheckoutSession } from "@/lib/billing/service";
import { isStripeConfigured } from "@/lib/billing/stripe";
import type { PlanTier } from "@/lib/billing/plans";

export async function POST(req: Request) {
  const owner = await ensureOwner();
  if (!owner) return new Response("unauthorized", { status: 401 });
  if (!isStripeConfigured()) {
    return Response.json({ error: "Billing is not configured yet" }, { status: 503 });
  }
  const { tier } = (await req.json().catch(() => ({}))) as { tier?: PlanTier };
  if (!tier || tier === "free") {
    return Response.json({ error: "invalid plan" }, { status: 400 });
  }
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
  try {
    const url = await createCheckoutSession(owner, tier, {
      successUrl: `${base}/dashboard/billing?status=success`,
      cancelUrl: `${base}/dashboard/billing?status=cancel`,
    });
    return Response.json({ url });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}
