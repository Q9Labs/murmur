import { describe, expect, it } from "vitest";

import { previewPlans } from "../../screens/previewFixtures";
import { paywallChoices } from "./paywallChoices";

describe("paywall choices", () => {
  it("defaults to Trip Pass, then Pro yearly, then Pro monthly", () => {
    expect(paywallChoices(previewPlans).defaultKey).toBe("pack");
    expect(paywallChoices(previewPlans.filter((plan) => plan.term !== "pack")).defaultKey).toBe("yearly");
    expect(paywallChoices(previewPlans.filter((plan) => plan.term === "monthly")).defaultKey).toBe("monthly");
  });
  it("keeps the lite offering's 30-minute Trip Pass and excludes unrelated 60-minute packs", () => {
    const litePlans = previewPlans.map((plan) => plan.id === "trip_pass_60" ? { ...plan, id: "trip_pass_30", minutes: 30 } : plan);
    const pass = litePlans.find((plan) => plan.id === "trip_pass_30");
    expect(paywallChoices(litePlans)).toMatchObject({ defaultKey: "pack", pack: pass });
    expect(paywallChoices(litePlans.map((plan) => plan.id === "trip_pass_30" ? { ...plan, id: "other_pack", minutes: 60 } : plan)).pack).toBeUndefined();
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
