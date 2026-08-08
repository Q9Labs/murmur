import { beforeEach, describe, expect, it, vi } from "vitest";

const storeReview = vi.hoisted(() => ({
  isAvailableAsync: vi.fn(),
  requestReview: vi.fn(),
}));

vi.mock("expo-store-review", () => storeReview);

import { requestMurmurReview } from "./requestReview";

beforeEach(() => {
  vi.clearAllMocks();
  storeReview.isAvailableAsync.mockResolvedValue(true);
  storeReview.requestReview.mockResolvedValue(undefined);
});

describe("request Murmur review", () => {
  it("requests the native review UI when it is available", async () => {
    await expect(requestMurmurReview()).resolves.toBe(true);
    expect(storeReview.requestReview).toHaveBeenCalledOnce();
  });

  it("does not request a review when the native UI is unavailable", async () => {
    storeReview.isAvailableAsync.mockResolvedValue(false);

    await expect(requestMurmurReview()).resolves.toBe(false);
    expect(storeReview.requestReview).not.toHaveBeenCalled();
  });

  it("fails quietly when the native review module rejects", async () => {
    storeReview.requestReview.mockRejectedValue(new Error("native failure"));

    await expect(requestMurmurReview()).resolves.toBe(false);
  });
});
