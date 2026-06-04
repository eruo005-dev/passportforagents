import { constructStripeEvent, routeStripeEvent } from "@/lib/billing/webhook";

/**
 * Stripe webhook. Reads the RAW body (required for signature verification),
 * verifies via STRIPE_WEBHOOK_SECRET, then routes subscription events to update
 * the owner's plan. 400 on bad/missing signature; 200 on handled/ignored.
 */
export async function POST(req: Request) {
  const signature = req.headers.get("stripe-signature");
  if (!signature) return new Response("missing stripe-signature", { status: 400 });

  const rawBody = await req.text();
  let event;
  try {
    event = constructStripeEvent(rawBody, signature);
  } catch (e) {
    return new Response(`signature verification failed: ${(e as Error).message}`, { status: 400 });
  }

  try {
    const result = await routeStripeEvent(event);
    return Response.json({ received: true, ...result });
  } catch {
    return new Response("webhook handler error", { status: 500 });
  }
}
