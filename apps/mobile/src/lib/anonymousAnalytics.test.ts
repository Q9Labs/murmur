import { afterEach, describe, expect, it, vi } from "vitest";

const secureStore = vi.hoisted(() => ({
  deleteItemAsync: vi.fn(),
  getItemAsync: vi.fn(),
  setItemAsync: vi.fn(),
}));

vi.mock("expo-secure-store", () => secureStore);
vi.mock("react-native", () => ({ Platform: { OS: "ios" } }));

import {
  deleteAnonymousAnalyticsPreference,
  getAnonymousAnalyticsEnabled,
  setAnonymousAnalyticsEnabled,
} from "./anonymousAnalytics";

afterEach(() => {
  vi.clearAllMocks();
});

describe("anonymous analytics preference", () => {
  it("defaults to enabled when no preference exists", async () => {
    secureStore.getItemAsync.mockResolvedValueOnce(null);

    await expect(getAnonymousAnalyticsEnabled()).resolves.toBe(true);
  });

  it("persists opt-out and supports local-data deletion", async () => {
    secureStore.getItemAsync.mockResolvedValueOnce("false");

    await expect(getAnonymousAnalyticsEnabled()).resolves.toBe(false);
    await setAnonymousAnalyticsEnabled(false);
    await deleteAnonymousAnalyticsPreference();

    expect(secureStore.setItemAsync).toHaveBeenCalledWith(
      "murmur_anonymous_analytics_enabled_v1",
      "false",
    );
    expect(secureStore.deleteItemAsync).toHaveBeenCalledWith(
      "murmur_anonymous_analytics_enabled_v1",
    );
  });
});
