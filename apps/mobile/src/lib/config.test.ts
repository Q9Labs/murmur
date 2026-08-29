import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getRevenueCatApiKeys,
  getSentryDsn,
  getUiPreviewScreen,
  getWorkerBaseUrl,
} from "./config";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Worker URL config", () => {
  it("uses the explicit Expo public Worker URL when provided", () => {
    vi.stubEnv("EXPO_PUBLIC_MURMUR_WORKER_URL", "https://worker.example.test");
    vi.stubEnv("NODE_ENV", "production");

    expect(getWorkerBaseUrl()).toBe("https://worker.example.test");
  });

  it("falls back to localhost only in development", () => {
    vi.stubEnv("EXPO_PUBLIC_MURMUR_WORKER_URL", "");
    vi.stubEnv("NODE_ENV", "development");

    expect(getWorkerBaseUrl()).toBe("http://localhost:8787");
  });

  it("falls back to the public Murmur host outside development", () => {
    vi.stubEnv("EXPO_PUBLIC_MURMUR_WORKER_URL", "");
    vi.stubEnv("NODE_ENV", "production");

    expect(getWorkerBaseUrl()).toBe("https://murmur.q9labs.ai");
  });
});

describe("Sentry config", () => {
  it("returns only a non-empty public DSN", () => {
    vi.stubEnv("EXPO_PUBLIC_SENTRY_DSN", " https://public@sentry.example/1 ");
    expect(getSentryDsn()).toBe("https://public@sentry.example/1");

    vi.stubEnv("EXPO_PUBLIC_SENTRY_DSN", "");
    expect(getSentryDsn()).toBeUndefined();
  });
});

describe("RevenueCat config", () => {
  it("returns trimmed public store keys", () => {
    vi.stubEnv("EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY", " google-public-key ");
    vi.stubEnv("EXPO_PUBLIC_REVENUECAT_IOS_API_KEY", " apple-public-key ");

    expect(getRevenueCatApiKeys()).toEqual({
      android: "google-public-key",
      ios: "apple-public-key",
    });
  });

  it("omits empty store keys", () => {
    vi.stubEnv("EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY", "");
    vi.stubEnv("EXPO_PUBLIC_REVENUECAT_IOS_API_KEY", "  ");

    expect(getRevenueCatApiKeys()).toEqual({ android: undefined, ios: undefined });
  });
});

describe("UI preview config", () => {
  it("accepts only the deterministic development preview screens", () => {
    vi.stubEnv("EXPO_PUBLIC_MURMUR_UI_PREVIEW", "picker");
    expect(getUiPreviewScreen()).toBe("picker");

    vi.stubEnv("EXPO_PUBLIC_MURMUR_UI_PREVIEW", "settings");
    expect(getUiPreviewScreen()).toBe("settings");

    vi.stubEnv("EXPO_PUBLIC_MURMUR_UI_PREVIEW", "translation");
    expect(getUiPreviewScreen()).toBe("translation");

    vi.stubEnv("EXPO_PUBLIC_MURMUR_UI_PREVIEW", "welcome");
    expect(getUiPreviewScreen()).toBe("welcome");

    vi.stubEnv("EXPO_PUBLIC_MURMUR_UI_PREVIEW", "other");
    expect(getUiPreviewScreen()).toBeNull();
  });
});
