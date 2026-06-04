import "server-only";
import Stripe from "stripe";

/**
 * Lazy, memoized Stripe client. Constructed on first CALL — never at import —
 * so the app builds and boots with a blank STRIPE_SECRET_KEY. Throws a clear
 * error only when a billing operation is actually attempted unconfigured.
 */
let client: Stripe | null = null;

export function getStripe(): Stripe {
  if (client) return client;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not set — billing is not configured yet");
  }
  client = new Stripe(key);
  return client;
}

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}
