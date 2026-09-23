export type PostSessionPrompt = "insights_consent" | "phone_audio_gift" | "rating";

// At most one prompt after a completed session, most important first. The rating is only
// a candidate here: its own schedule decides afterwards whether this slot shows it.
export function nextPostSessionPrompt(params: {
  askInsightsConsent: boolean;
  offerPhoneAudioGift: boolean;
  ratingEligible: boolean;
}): PostSessionPrompt | null {
  if (params.askInsightsConsent) {
    return "insights_consent";
  }
  if (params.offerPhoneAudioGift) {
    return "phone_audio_gift";
  }
  return params.ratingEligible ? "rating" : null;
}
