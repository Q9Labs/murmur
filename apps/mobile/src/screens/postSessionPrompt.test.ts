import { describe, expect, it } from "vitest";

import { nextPostSessionPrompt } from "./postSessionPrompt";

const after = { completed: true, insightsConsent: true, phoneAudioGiftClaimable: false, ratingDue: false };

describe("post-session prompt", () => {
  it("asks nothing after a session that did not complete", () => {
    expect(nextPostSessionPrompt({ ...after, completed: false, insightsConsent: null, ratingDue: true })).toBeNull();
  });

  it("asks for insights consent first, then offers the gift, then the rating", () => {
    expect(nextPostSessionPrompt({ ...after, insightsConsent: null, phoneAudioGiftClaimable: true, ratingDue: true }))
      .toBe("insights_consent");
    expect(nextPostSessionPrompt({ ...after, phoneAudioGiftClaimable: true, ratingDue: true })).toBe("phone_audio_gift");
    expect(nextPostSessionPrompt({ ...after, insightsConsent: false, ratingDue: true })).toBe("rating");
    expect(nextPostSessionPrompt(after)).toBeNull();
  });
});
