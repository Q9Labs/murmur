import { beforeEach, describe, expect, it, vi } from "vitest";

const storage = vi.hoisted(() => ({
  deleteLocalValue: vi.fn(),
  getLocalValue: vi.fn(),
  setLocalValue: vi.fn(),
}));

vi.mock("./localStorage", () => storage);

import {
  deleteEngagementState,
  isQualifiedSession,
  markReviewRequested,
  recordSessionOutcome,
} from "./engagement";

beforeEach(() => {
  vi.clearAllMocks();
  storage.getLocalValue.mockResolvedValue(null);
});

describe("engagement", () => {
  it("qualifies repeated phrases or a minute of continuous captions", () => {
    expect(isQualifiedSession({
      committed_caption_count: 2,
      duration_ms: 10_000,
      error: null,
      translation_mode: "phrase",
    })).toBe(true);
    expect(isQualifiedSession({
      committed_caption_count: 1,
      duration_ms: 60_000,
      error: null,
      translation_mode: "continuous",
    })).toBe(true);
    expect(isQualifiedSession({
      committed_caption_count: 1,
      duration_ms: 59_999,
      error: null,
      translation_mode: "continuous",
    })).toBe(false);
    expect(isQualifiedSession({
      committed_caption_count: 3,
      duration_ms: 90_000,
      error: "translation_failed",
      translation_mode: "continuous",
    })).toBe(false);
  });

  it("requests a review after the third qualified session", async () => {
    storage.getLocalValue.mockResolvedValueOnce(JSON.stringify({
      last_review_request_at_ms: null,
      qualified_session_count: 2,
      review_requested_for_version: null,
    }));

    await expect(recordSessionOutcome({
      app_version: "1.2.0",
      now_ms: 1_000,
      outcome: {
        committed_caption_count: 2,
        duration_ms: 5_000,
        error: null,
        translation_mode: "phrase",
      },
    })).resolves.toEqual({
      qualified: true,
      qualified_session_count: 3,
      should_request_review: true,
    });
    expect(storage.setLocalValue).toHaveBeenCalledWith(
      "murmur_engagement_v1",
      JSON.stringify({
        last_review_request_at_ms: null,
        qualified_session_count: 3,
        review_requested_for_version: null,
      }),
    );
  });

  it("marks a native review request only after it is attempted", async () => {
    storage.getLocalValue.mockResolvedValueOnce(JSON.stringify({
      last_review_request_at_ms: null,
      qualified_session_count: 3,
      review_requested_for_version: null,
    }));

    await markReviewRequested({
      app_version: "1.2.0",
      now_ms: 2_000,
    });

    expect(storage.setLocalValue).toHaveBeenCalledWith(
      "murmur_engagement_v1",
      JSON.stringify({
        last_review_request_at_ms: 2_000,
        qualified_session_count: 3,
        review_requested_for_version: "1.2.0",
      }),
    );
  });

  it("does not repeat a review request for the same version", async () => {
    storage.getLocalValue.mockResolvedValueOnce(JSON.stringify({
      last_review_request_at_ms: 1_000,
      qualified_session_count: 4,
      review_requested_for_version: "1.2.0",
    }));

    const result = await recordSessionOutcome({
      app_version: "1.2.0",
      now_ms: 365 * 24 * 60 * 60 * 1000,
      outcome: {
        committed_caption_count: 2,
        duration_ms: 5_000,
        error: null,
        translation_mode: "phrase",
      },
    });

    expect(result.should_request_review).toBe(false);
  });

  it("recovers from corrupt local state and deletes it on request", async () => {
    storage.getLocalValue.mockResolvedValueOnce("{bad json");

    const result = await recordSessionOutcome({
      app_version: "1.2.0",
      outcome: {
        committed_caption_count: 0,
        duration_ms: 1_000,
        error: null,
        translation_mode: "phrase",
      },
    });
    expect(result.qualified_session_count).toBe(0);

    await deleteEngagementState();
    expect(storage.deleteLocalValue).toHaveBeenCalledWith("murmur_engagement_v1");
  });
});
