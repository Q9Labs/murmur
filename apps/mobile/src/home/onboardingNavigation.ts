import type { OnboardingStep } from "./types";

export function previousOnboardingStep(
  step: OnboardingStep,
  privacyAcknowledgementPending = false,
): OnboardingStep | null {
  if (privacyAcknowledgementPending) {
    return step;
  }
  switch (step) {
    case "privacy":
      return "welcome";
    case "languages":
      return "privacy";
    case "welcome":
    case "done":
      return null;
  }
}
