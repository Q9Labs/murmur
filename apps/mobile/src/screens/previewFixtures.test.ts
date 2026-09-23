import { describe, expect, it } from "vitest";

import { introDiscountPercent, planTabs } from "../lib/billing/planCatalog";
import {
  previewAuthStates,
  previewBilling,
  previewBillingFor,
  previewCheckoutPlanId,
  previewConversations,
  previewFreeServices,
  previewOfferBilling,
  previewOfferPlans,
  previewPackBilling,
  previewPlans,
  previewServices,
  previewSignedInBilling,
  previewUnsavedBilling,
} from "./previewFixtures";

describe("preview fixtures", () => {
  it("show the 1.3.0 US ladder, with Yearly at $8.33 a month", async () => {
    expect(planTabs(previewPlans).map((tab) => [tab.term, tab.plans.map((plan) => `${plan.title} ${plan.price}`)]))
      .toEqual([
        ["monthly", ["Pro $9.99", "Pro Max $29.99"]],
        ["yearly", ["Pro $99.99", "Pro Max $299.99"]],
        ["pack", ["Trip Pass $7.99", "Event Pass $29.99"]],
      ]);
    expect(previewPlans.find((plan) => plan.id === "$rc_annual")?.pricePerMonth).toBe("$8.33");
    expect(previewPlans.find((plan) => plan.id === previewCheckoutPlanId)?.term).toBe("yearly");
    await expect(previewBilling.loadPlans()).resolves.toBe(previewPlans);
  });

  it("describe a 20% personal offer that ends 47 hours 12 minutes from now", async () => {
    const billing = previewOfferBilling(1_000);
    expect(billing.config.personalOfferExpiresAtMs).toBe(1_000 + (47 * 60 + 12) * 60_000);
    await expect(billing.loadPlans()).resolves.toBe(previewOfferPlans);
    expect(introDiscountPercent(previewOfferPlans)).toBe(20);
  });

  it("describe guest, unsaved, pack and signed-in customers and every auth state", () => {
    expect(previewBilling.customer?.isRegistered).toBe(false);
    expect(previewSignedInBilling.customer).toMatchObject({ isRegistered: true, plan: "pro" });
    expect(previewUnsavedBilling.customer).toMatchObject({ isRegistered: false, plan: "pro" });
    expect(previewPackBilling.customer?.creditMs).toBeGreaterThan(0);
    expect(previewBillingFor({ availableMs: 0 }).customer?.availableMs).toBe(0);
    expect(Object.keys(previewAuthStates)).toContain("auth-code-error");
    expect(previewAuthStates["auth-code-error"].error).toContain("doesn't match");
  });

  it("give Pro screens conversations and free screens the gates", async () => {
    expect(previewServices.conversations).toBe(previewConversations);
    expect(previewServices.features).toEqual({ history: true, phoneAudio: true });
    expect(previewFreeServices.features).toEqual({ history: false, phoneAudio: false });
    await expect(previewServices.claimPhoneAudioGift()).resolves.toBeUndefined();
  });
});
