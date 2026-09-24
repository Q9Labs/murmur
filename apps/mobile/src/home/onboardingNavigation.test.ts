import { describe, expect, it } from "vitest";

import { previousOnboardingStep } from "./onboardingNavigation";

describe("onboarding back navigation", () => {
  it("returns from each later step to the previous one", () => {
    expect(previousOnboardingStep("privacy")).toBe("welcome");
    expect(previousOnboardingStep("languages")).toBe("privacy");
  });

  it("allows the app to exit only from the first step or after onboarding", () => {
    expect(previousOnboardingStep("welcome")).toBeNull();
    expect(previousOnboardingStep("done")).toBeNull();
  });

  it("keeps privacy onboarding active while its acknowledgement is being saved", () => {
    expect(previousOnboardingStep("privacy", true)).toBe("privacy");
  });
});
