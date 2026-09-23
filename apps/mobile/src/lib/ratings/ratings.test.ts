import { beforeEach, describe, expect, it, vi } from "vitest";

const storage = vi.hoisted(() => new Map<string, string>());
const review = vi.hoisted(() => ({
  isAvailableAsync: vi.fn(async () => true),
  requestReview: vi.fn(async () => undefined),
}));
const capture = vi.hoisted(() => vi.fn());

vi.mock("react-native", () => ({ Platform: { OS: "android" } }));
vi.mock("expo-store-review", () => review);
vi.mock("@sentry/react-native", () => ({ captureException: vi.fn() }));
vi.mock("../localStorage", () => ({
  getLocalValue: vi.fn(async (key: string) => storage.get(key) ?? null),
  setLocalValue: vi.fn(async (key: string, value: string) => { storage.set(key, value); }),
  deleteLocalValue: vi.fn(async (key: string) => { storage.delete(key); }),
}));
vi.mock("../telemetry", () => ({ captureMobileTelemetry: capture }));
vi.mock("../config", () => ({ getWorkerBaseUrl: () => "https://murmur.test" }));
vi.mock("../auth/client", () => ({ authenticatedWorkerHeaders: vi.fn(async () => ({})) }));
vi.mock("../installIdentity", () => ({ getOrCreateInstallId: vi.fn(async () => "install_12345678") }));

import { claimRatingSlot, recordCompletedSession, submitRating } from "./ratings";

beforeEach(() => {
  storage.clear();
  review.requestReview.mockClear();
  capture.mockClear();
  vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 202 })));
});

describe("ratings integration", () => {
  it("asks insights consent after the first completed session even when under 60 seconds", async () => {
    expect(await recordCompletedSession({
      committed_caption_count: 1,
      duration_ms: 12_000,
      error: null,
    })).toMatchObject({ askInsightsConsent: true, ratingEligible: false, successfulSessionCount: 0 });
    expect(await recordCompletedSession({
      committed_caption_count: 1,
      duration_ms: 12_000,
      error: null,
    })).toMatchObject({ askInsightsConsent: false });
  });

  it("returns decisions for the UI and prompts Play only after the third successful session", async () => {
    const completion = { committed_caption_count: 1, duration_ms: 60_000, error: null };
    expect(await recordCompletedSession(completion)).toMatchObject({
      askInsightsConsent: true,
      ratingEligible: true,
      successfulSessionCount: 1,
    });
    expect(await recordCompletedSession(completion)).toMatchObject({ ratingEligible: true, successfulSessionCount: 2 });
    await submitRating({ answer: "travel", stars: 5 });
    expect(review.requestReview).not.toHaveBeenCalled();
    expect(await recordCompletedSession(completion)).toMatchObject({ ratingEligible: true, successfulSessionCount: 3 });
    expect(review.requestReview).toHaveBeenCalledOnce();
    expect(capture).toHaveBeenCalledWith({ event: "store_review_prompted", platform: "android" });
  });

  it("schedules the rating by the sessions where it was eligible, not every successful one", async () => {
    const shown: boolean[] = [];
    for (let slot = 1; slot <= 8; slot += 1) {
      shown.push(await claimRatingSlot());
    }
    expect(shown).toEqual([true, true, false, false, true, false, false, true]);
  });
});
