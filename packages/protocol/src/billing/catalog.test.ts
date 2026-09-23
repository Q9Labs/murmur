import { describe, expect, it } from "vitest";

import {
  billingProducts,
  findBillingProduct,
  freeAllowanceMs,
  isPersonalOfferProduct,
  liteProAllowanceMs,
  proAllowanceMs,
  proMaxAllowanceMs,
} from "./catalog";

describe("billing catalog", () => {
  it("keeps the approved allowance values", () => {
    expect(freeAllowanceMs).toBe(7 * 60_000);
    expect(proAllowanceMs).toBe(120 * 60_000);
    expect(proMaxAllowanceMs).toBe(400 * 60_000);
    expect(liteProAllowanceMs).toBe(90 * 60_000);
  });

  it("maps every Apple and Google identifier to one product", () => {
    expect(new Set(billingProducts.map((product) => product.appleProductId)).size).toBe(billingProducts.length);
    expect(new Set(billingProducts.map((product) =>
      `${product.googleProductId}:${product.googleOfferId ?? "base"}`,
    )).size).toBe(billingProducts.length);

    for (const product of billingProducts) {
      expect(findBillingProduct("apple", product.appleProductId)?.code).toBe(product.code);
      expect(findBillingProduct("google", product.googleProductId, product.googleOfferId)?.code).toBe(product.code);
      expect(findBillingProduct("google", product.googleProductId, product.googleOfferId)?.personalOffer)
        .toBe(product.personalOffer);
    }
  });

  it("uses Play's personal-20 offer on the same base-plan IDs", () => {
    expect(findBillingProduct("google", "murmur_pro:monthly")?.personalOffer).toBeUndefined();
    expect(findBillingProduct("google", "murmur_pro:monthly", "personal-20")?.personalOffer).toBe(true);
    expect(findBillingProduct("google", "murmur_pro_lite:annual", "personal-20")?.grantMs)
      .toBe(liteProAllowanceMs);
    expect(isPersonalOfferProduct("murmur_pro:monthly", "personal-20")).toBe(true);
    expect(isPersonalOfferProduct("murmur_pro:monthly")).toBe(false);
  });

  it("ships the final store ladder without retired packs", () => {
    const ids = billingProducts.flatMap((product) => [product.appleProductId, product.googleProductId]);
    expect(ids).toContain("com.q9labsai.murmur.promax.monthly");
    expect(ids).toContain("murmur_promax:annual");
    expect(ids).toContain("com.q9labsai.murmur.credits.30.lite");
    expect(ids).toContain("murmur_credits_300");
    expect(ids.some((id) => id.includes("180") || id.includes("540"))).toBe(false);
  });

  it("recognizes retired purchases for entitlement and refund handling without offering them for sale", () => {
    expect(findBillingProduct("google", "murmur_pro_offer:monthly")?.grantMs).toBe(180 * 60_000);
    expect(findBillingProduct("apple", "com.q9labsai.murmur.pro.annual.in.offer")?.grantMs)
      .toBe(liteProAllowanceMs);
    expect(findBillingProduct("google", "murmur_pro_in_offer:annual")?.kind).toBe("subscription");
    expect(findBillingProduct("apple", "com.q9labsai.murmur.credits.180")?.grantMs)
      .toBe(180 * 60_000);
    expect(findBillingProduct("google", "murmur_credits_540")?.kind).toBe("credit_pack");
    expect(isPersonalOfferProduct("murmur_pro_offer:monthly")).toBe(true);
    expect(billingProducts.some((product) => product.code === "credits_180" || product.code === "credits_540"))
      .toBe(false);
  });

  it("does not accept an unknown store product", () => {
    expect(findBillingProduct("apple", "com.example.unknown")).toBeNull();
    expect(findBillingProduct("google", "unknown")).toBeNull();
  });

  it("keeps at least ten percent contribution at conservative full use", () => {
    for (const product of billingProducts) {
      if (product.basePriceUsdCents === null) {
        continue;
      }
      const billedMinutes = product.grantMs / 60_000 *
        (product.kind === "subscription" && product.code.includes("annual") ? 12 : 1);
      const contributionUsdCents = product.basePriceUsdCents * 0.69 - billedMinutes * 3.4;
      expect(contributionUsdCents / product.basePriceUsdCents).toBeGreaterThanOrEqual(0.1);
    }
  });

  it("prices annual Pro below twelve monthly payments", () => {
    const monthly = billingProducts.find((product) => product.code === "pro_monthly");
    const annual = billingProducts.find((product) => product.code === "pro_annual");
    expect(monthly).toBeDefined();
    expect(annual).toBeDefined();
    if (!monthly || !annual || monthly.basePriceUsdCents === null || annual.basePriceUsdCents === null) {
      return;
    }
    const discount = 1 - annual.basePriceUsdCents / (monthly.basePriceUsdCents * 12);
    expect(discount).toBeGreaterThan(0.16);
    expect(discount).toBeLessThan(0.17);
  });
});
