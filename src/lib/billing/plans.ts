/**
 * Plan / quota / price source of truth. Pure constants — no Stripe import, safe
 * to use anywhere (including the quota meter). Price IDs come from env (filled by
 * the human after creating Products in the Stripe dashboard); blank until then.
 */
export type PlanTier = "free" | "pro" | "team" | "business";

/** Monthly billable verify-call quota per plan (Team/Business pending human confirm). */
export const PLAN_QUOTAS: Record<PlanTier, number> = {
  free: 1_000,
  pro: 25_000,
  team: 100_000,
  business: 250_000,
};

/** Monthly subscription price (USD) — display only; Stripe holds the real price. */
export const PLAN_PRICE_USD: Record<PlanTier, number> = {
  free: 0,
  pro: 29,
  team: 99,
  business: 199,
};

/** Per-call overage above quota (metered) — reported to Stripe once configured. */
export const OVERAGE_PER_CALL_USD = 0.005;

export const PAID_TIERS: PlanTier[] = ["pro", "team", "business"];

const PRICE_ENV: Record<Exclude<PlanTier, "free">, string> = {
  pro: "STRIPE_PRICE_PRO",
  team: "STRIPE_PRICE_TEAM",
  business: "STRIPE_PRICE_BUSINESS",
};

/** Stripe price id for a paid tier, or null if not configured yet. */
export function planToPriceId(tier: PlanTier): string | null {
  if (tier === "free") return null;
  return process.env[PRICE_ENV[tier]] || null;
}

/** Reverse-map a Stripe price id to a plan tier (for webhook handling). */
export function priceIdToPlan(priceId: string | null | undefined): PlanTier | null {
  if (!priceId) return null;
  for (const tier of PAID_TIERS) {
    if (process.env[PRICE_ENV[tier as Exclude<PlanTier, "free">]] === priceId) return tier;
  }
  return null;
}

export function quotaForPlan(tier: PlanTier): number {
  return PLAN_QUOTAS[tier] ?? PLAN_QUOTAS.free;
}
