export type PostSessionPrompt = "insights_consent" | "phone_audio_gift" | "rating";

// At most one prompt after a completed session, most important first. Whatever is
// skipped comes back after a later session.
export function nextPostSessionPrompt(params: {
  completed: boolean;
  insightsConsent: boolean | null;
  phoneAudioGiftClaimable: boolean;
  ratingDue: boolean;
}): PostSessionPrompt | null {
  if (!params.completed) {
    return null;
  }
  if (params.insightsConsent === null) {
    return "insights_consent";
  }
  if (params.phoneAudioGiftClaimable) {
    return "phone_audio_gift";
  }
  return params.ratingDue ? "rating" : null;
}
