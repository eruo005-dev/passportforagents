import { ensureOwner } from "@/lib/owners";
import { createPortalSession } from "@/lib/billing/service";
import { isStripeConfigured } from "@/lib/billing/stripe";

export async function POST() {
  const owner = await ensureOwner();
  if (!owner) return new Response("unauthorized", { status: 401 });
  if (!isStripeConfigured()) {
    return Response.json({ error: "Billing is not configured yet" }, { status: 503 });
  }
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
  try {
    const url = await createPortalSession(owner, `${base}/dashboard/billing`);
    return Response.json({ url });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}
