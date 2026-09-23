import { describe, expect, it } from "vitest";

import { nextPostSessionPrompt } from "./postSessionPrompt";

const after = { askInsightsConsent: false, offerPhoneAudioGift: false, ratingEligible: false };

describe("post-session prompt", () => {
  it("asks nothing when no prompt is due", () => {
    expect(nextPostSessionPrompt(after)).toBeNull();
  });

  it("asks for insights consent first, then offers the gift, then the rating", () => {
    expect(nextPostSessionPrompt({ askInsightsConsent: true, offerPhoneAudioGift: true, ratingEligible: true }))
      .toBe("insights_consent");
    expect(nextPostSessionPrompt({ ...after, offerPhoneAudioGift: true, ratingEligible: true })).toBe("phone_audio_gift");
    expect(nextPostSessionPrompt({ ...after, ratingEligible: true })).toBe("rating");
  });
});
