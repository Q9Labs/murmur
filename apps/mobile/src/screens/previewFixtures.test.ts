import { describe, expect, it } from "vitest";

import { billingProducts } from "@murmur/protocol/billing/catalog";

import { planTabs, plansFromCatalog } from "../lib/billing/planCatalog";
import {
  previewAuthStates,
  previewBilling,
  previewBillingFor,
  previewPlans,
  previewCheckoutPlanId,
  previewSignedInBilling,
} from "./previewFixtures";

describe("preview fixtures", () => {
  it("show exactly what the shared billing catalog sells", async () => {
    expect(previewPlans).toEqual(plansFromCatalog(billingProducts));
    expect(planTabs(previewPlans).map((tab) => tab.term)).toEqual(["monthly", "yearly", "pack"]);
    for (const plan of previewPlans) {
      const product = billingProducts.find((candidate) =>
        candidate.revenueCatPackageId === plan.id && candidate.personalOffer !== true);
      expect(product?.basePriceUsdCents).toBe(Math.round(plan.priceAmount * 100));
    }
    expect(previewPlans.find((plan) => plan.id === previewCheckoutPlanId)?.term).toBe("yearly");
    await expect(previewBilling.loadPlans()).resolves.toBe(previewPlans);
  });

  it("describe guest and signed-in customers and every auth state", () => {
    expect(previewBilling.customer?.isRegistered).toBe(false);
    expect(previewSignedInBilling.customer).toMatchObject({ isRegistered: true, plan: "pro" });
    expect(previewBillingFor({ availableMs: 0 }).customer?.availableMs).toBe(0);
    expect(Object.keys(previewAuthStates)).toContain("auth-code-error");
    expect(previewAuthStates["auth-code-error"].error).toContain("doesn't match");
  });
});
