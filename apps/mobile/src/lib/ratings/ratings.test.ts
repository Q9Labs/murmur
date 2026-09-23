import { beforeEach, describe, expect, it, vi } from "vitest";

const storage = vi.hoisted(() => new Map<string, string>());
const review = vi.hoisted(() => ({
  isAvailableAsync: vi.fn(async () => true),
  requestReview: vi.fn(async () => undefined),
}));
const capture = vi.hoisted(() => vi.fn());
const authenticatedHeaders = vi.hoisted(() => vi.fn(async () => new Headers({
  cookie: "murmur.session=signed-in-cookie",
})));

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
vi.mock("../auth/client", () => ({ authenticatedWorkerHeaders: authenticatedHeaders }));
vi.mock("../installIdentity", () => ({ getOrCreateInstallId: vi.fn(async () => "install_12345678") }));

import { claimRatingSlot, recordCompletedSession, submitRating } from "./ratings";

beforeEach(() => {
  storage.clear();
  review.requestReview.mockClear();
  capture.mockClear();
  authenticatedHeaders.mockClear();
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
    expect(capture).not.toHaveBeenCalledWith(expect.objectContaining({ event: "rating_submitted" }));
  });

  it("sends survey answers only to Murmur and includes Better Auth headers", async () => {
    await submitRating({ answer: "other", otherText: "Parent evening", stars: 5 });

    const requests = vi.mocked(fetch).mock.calls;
    expect(requests).toHaveLength(1);
    expect(String(requests[0]?.[0])).toBe("https://murmur.test/v3/ratings");
    expect(new Headers(requests[0]?.[1]?.headers).get("cookie")).toBe("murmur.session=signed-in-cookie");
    expect(JSON.parse(String(requests[0]?.[1]?.body))).toEqual({
      app_install_id: "install_12345678",
      answer: "other",
      other_text: "Parent evening",
      stars: 5,
    });
    expect(capture).not.toHaveBeenCalledWith(expect.objectContaining({ event: "rating_submitted" }));
  });

  it("schedules the rating by the sessions where it was eligible, not every successful one", async () => {
    const shown: boolean[] = [];
    for (let slot = 1; slot <= 8; slot += 1) {
      shown.push(await claimRatingSlot());
    }
    expect(shown).toEqual([true, true, false, false, true, false, false, true]);
  });
});
