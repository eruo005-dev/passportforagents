import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PLAN_QUOTAS,
  planToPriceId,
  priceIdToPlan,
  quotaForPlan,
} from "../src/lib/billing/plans";

test("billing: plan quotas", () => {
  assert.equal(PLAN_QUOTAS.free, 1000);
  assert.equal(PLAN_QUOTAS.pro, 25000);
  assert.equal(PLAN_QUOTAS.team, 100000);
  assert.equal(PLAN_QUOTAS.business, 250000);
  assert.equal(quotaForPlan("pro"), 25000);
});

test("billing: price id mapping is env-driven + reversible", () => {
  const prev = process.env.STRIPE_PRICE_PRO;
  try {
    assert.equal(planToPriceId("free"), null);
    process.env.STRIPE_PRICE_PRO = "price_pro_123";
    assert.equal(planToPriceId("pro"), "price_pro_123");
    assert.equal(priceIdToPlan("price_pro_123"), "pro");
    assert.equal(priceIdToPlan("price_unknown"), null);
    assert.equal(priceIdToPlan(null), null);
  } finally {
    if (prev === undefined) delete process.env.STRIPE_PRICE_PRO;
    else process.env.STRIPE_PRICE_PRO = prev;
  }
});
