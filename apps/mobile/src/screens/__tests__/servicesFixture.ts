import { vi } from "vitest";

import type { ConversationRecord, ScreenServices } from "../screenServices";

export const fixtureConversation: ConversationRecord = {
  durationMs: 12 * 60_000,
  id: "conversation-1",
  sourceLanguage: "ar",
  startedAtMs: Date.UTC(2026, 8, 3, 14, 5),
  targetLanguage: "en",
  text: "Welcome to the conference. The first talk starts at nine.",
};

export function fixtureServices(overrides: Partial<ScreenServices> = {}): ScreenServices {
  return {
    claimPhoneAudioGift: vi.fn(async () => undefined),
    conversations: [],
    deleteConversation: vi.fn(async () => undefined),
    features: { history: false, phoneAudio: false },
    insightsConsent: null,
    phoneAudioGift: { claimable: false, remainingMs: 0 },
    ratingDue: false,
    setInsightsConsent: vi.fn(async () => undefined),
    signInWithApple: vi.fn(async () => undefined),
    signInWithGoogle: vi.fn(async () => undefined),
    submitRating: vi.fn(async () => undefined),
    ...overrides,
  };
}
