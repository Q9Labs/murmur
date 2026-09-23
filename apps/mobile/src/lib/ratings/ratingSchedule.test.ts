import { describe, expect, it } from "vitest";

import {
  isSuccessfulSession,
  shouldRequestStoreReview,
  shouldShowRating,
} from "./ratingSchedule";

describe("rating schedule", () => {
  it("samples the first, second, fifth and every third thereafter", () => {
    expect(Array.from({ length: 12 }, (_, index) => index + 1).filter(shouldShowRating))
      .toEqual([1, 2, 5, 8, 11]);
  });

  it("counts only completed sessions lasting at least 60 seconds", () => {
    expect(isSuccessfulSession({ committed_caption_count: 1, duration_ms: 59_999, error: null }))
      .toBe(false);
    expect(isSuccessfulSession({ committed_caption_count: 0, duration_ms: 60_000, error: null }))
      .toBe(true);
    expect(isSuccessfulSession({ committed_caption_count: 1, duration_ms: 60_000, error: "failed" }))
      .toBe(false);
  });

  it("gates iOS on positive stars or the third success, but Android only on the third success", () => {
    expect(shouldRequestStoreReview("ios", 1, 4, false)).toBe(true);
    expect(shouldRequestStoreReview("ios", 3, null, false)).toBe(true);
    expect(shouldRequestStoreReview("ios", 3, null, true)).toBe(false);
    expect(shouldRequestStoreReview("android", 1, 5, false)).toBe(false);
    expect(shouldRequestStoreReview("android", 3, 1, false)).toBe(true);
    expect(shouldRequestStoreReview("android", 3, null, true)).toBe(false);
  });
});
