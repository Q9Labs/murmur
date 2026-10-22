import { describe, expect, it } from "vitest";

import { previewPlans } from "../../screens/previewFixtures";
import { paywallChoices } from "./paywallChoices";

describe("paywall choices", () => {
  it("defaults to the 60-minute pass, then Pro yearly, then Pro monthly", () => {
    expect(paywallChoices(previewPlans).defaultKey).toBe("pack");
    expect(paywallChoices(previewPlans.filter((plan) => plan.term !== "pack")).defaultKey).toBe("yearly");
    expect(paywallChoices(previewPlans.filter((plan) => plan.term === "monthly")).defaultKey).toBe("monthly");
  });
  it("excludes Pro Max and other credit packs", () => {
    const choices = paywallChoices(previewPlans);
    expect(choices.pack?.id).toBe("trip_pass_60");
    expect(choices.monthly?.tier).toBe("pro");
    expect(choices.yearly?.tier).toBe("pro");
    expect(paywallChoices(previewPlans.filter((plan) => plan.tier === "pro_max" || plan.minutes === 300)))
      .toEqual({ defaultKey: null, pack: undefined, monthly: undefined, yearly: undefined });
  });
  it("handles no plans and does not mutate the store catalog", () => {
    expect(paywallChoices([]).defaultKey).toBeNull();
    const original = [...previewPlans];
    paywallChoices(previewPlans);
    expect(previewPlans).toEqual(original);
  });
});
