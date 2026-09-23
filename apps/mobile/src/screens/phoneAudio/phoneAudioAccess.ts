import type { PhoneAudioGift, ProFeatures } from "../screenServices";

export const phoneAudioGiftMinutes = 3;

export type PhoneAudioAccess = "gift_active" | "gift_claimable" | "included" | "locked";

export function phoneAudioAccess(features: ProFeatures, gift: PhoneAudioGift): PhoneAudioAccess {
  if (gift.remainingMs > 0) {
    return "gift_active";
  }
  if (features.phoneAudio) {
    return "included";
  }
  return gift.claimable ? "gift_claimable" : "locked";
}
