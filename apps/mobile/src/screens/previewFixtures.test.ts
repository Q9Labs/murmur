import { describe, expect, it } from "vitest";

import { planTabs, yearlySaving } from "../lib/billing/planCatalog";
import {
  previewAuthStates,
  previewBilling,
  previewBillingFor,
  previewPlans,
  previewSignedInBilling,
  previewYearlyPlan,
} from "./previewFixtures";

describe("preview fixtures", () => {
  it("carry the proposed US ladder across all three tabs", async () => {
    expect(planTabs(previewPlans).map((tab) => tab.term)).toEqual(["monthly", "yearly", "pack"]);
    expect(yearlySaving(previewYearlyPlan, previewPlans)).toEqual({ monthsFree: 1, percent: 16 });
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
