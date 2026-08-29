import { describe, expect, it } from "vitest";

import {
  billingProducts,
  findBillingProduct,
  freeAllowanceMs,
  proAllowanceMs,
} from "./catalog";

describe("billing catalog", () => {
  it("keeps the approved allowance values", () => {
    expect(freeAllowanceMs).toBe(30 * 60 * 1_000);
    expect(proAllowanceMs).toBe(180 * 60 * 1_000);
  });

  it("maps every Apple and Google identifier to one product", () => {
    expect(new Set(billingProducts.map((product) => product.appleProductId)).size).toBe(5);
    expect(new Set(billingProducts.map((product) => product.googleProductId)).size).toBe(5);

    for (const product of billingProducts) {
      expect(findBillingProduct("apple", product.appleProductId)?.code).toBe(product.code);
      expect(findBillingProduct("google", product.googleProductId)?.code).toBe(product.code);
    }
  });

  it("does not accept an unknown store product", () => {
    expect(findBillingProduct("apple", "com.example.unknown")).toBeNull();
    expect(findBillingProduct("google", "unknown")).toBeNull();
  });

  it("keeps at least ten percent contribution at conservative full use", () => {
    for (const product of billingProducts) {
      const billedMinutes = product.grantMs / 60_000 *
        (product.code === "pro_annual" ? 12 : 1);
      const contributionUsdCents = product.basePriceUsdCents * 0.69 - billedMinutes * 3.4;
      expect(contributionUsdCents / product.basePriceUsdCents).toBeGreaterThanOrEqual(0.1);
    }
  });

  it("prices annual Pro about twenty percent below twelve monthly payments", () => {
    const monthly = billingProducts.find((product) => product.code === "pro_monthly");
    const annual = billingProducts.find((product) => product.code === "pro_annual");
    expect(monthly).toBeDefined();
    expect(annual).toBeDefined();
    if (!monthly || !annual) {
      return;
    }
    const discount = 1 - annual.basePriceUsdCents / (monthly.basePriceUsdCents * 12);
    expect(discount).toBeCloseTo(0.2, 2);
  });
});
