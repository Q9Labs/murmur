import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  getMurmurEnvironment,
  getRevenueCatApiKeys,
  getRevenueCatOfferingId,
  getSentryDsn,
  getUiPreviewScreen,
  getWorkerBaseUrl,
} from "./config";

const updates = vi.hoisted((): { channel: string | null } => ({ channel: null }));
vi.mock("expo-updates", () => ({ get channel() { return updates.channel; } }));

beforeEach(() => { updates.channel = null; });

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Worker URL config", () => {
  it("keeps the existing explicit production build target", () => {
    updates.channel = "production";
    vi.stubEnv("EXPO_PUBLIC_MURMUR_ENV", "production");
    vi.stubEnv("EXPO_PUBLIC_MURMUR_WORKER_URL", "https://murmur.q9labs.ai");
    vi.stubEnv("NODE_ENV", "production");
    expect(getWorkerBaseUrl()).toBe("https://murmur.q9labs.ai");
  });

  it("uses dev for a preview binary even though release JavaScript uses NODE_ENV=production", () => {
    updates.channel = "preview";
    vi.stubEnv("EXPO_PUBLIC_MURMUR_ENV", "preview");
    vi.stubEnv("EXPO_PUBLIC_MURMUR_WORKER_URL", "https://murmur-worker-dev.msbilal.workers.dev");
    vi.stubEnv("NODE_ENV", "production");
    expect(getWorkerBaseUrl()).toBe("https://murmur-worker-dev.msbilal.workers.dev");
  });

  it("rejects production variables delivered to an installed preview channel", () => {
    updates.channel = "preview";
    vi.stubEnv("EXPO_PUBLIC_MURMUR_ENV", "production");
    vi.stubEnv("EXPO_PUBLIC_MURMUR_WORKER_URL", "https://murmur.q9labs.ai");
    expect(() => getWorkerBaseUrl()).toThrow(/explicit environment/);
  });

  it("fails before a request when a release or OTA is missing its target", () => {
    vi.stubEnv("EXPO_PUBLIC_MURMUR_ENV", "");
    vi.stubEnv("EXPO_PUBLIC_MURMUR_WORKER_URL", "");
    vi.stubEnv("NODE_ENV", "production");
    expect(() => getWorkerBaseUrl()).toThrow(/known Murmur/);
    updates.channel = "production";
    expect(() => getWorkerBaseUrl()).toThrow(/explicit environment/);
  });

  it("keeps localhost only for local development without an installed channel", () => {
    vi.stubEnv("EXPO_PUBLIC_MURMUR_ENV", "");
    vi.stubEnv("EXPO_PUBLIC_MURMUR_WORKER_URL", "");
    vi.stubEnv("NODE_ENV", "development");
    expect(getWorkerBaseUrl()).toBe("http://localhost:8787");
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

describe("Murmur environment config", () => {
  it("uses an explicit isolated environment label", () => {
    vi.stubEnv("EXPO_PUBLIC_MURMUR_ENV", "sandbox");
    vi.stubEnv("NODE_ENV", "production");
    expect(getMurmurEnvironment()).toBe("sandbox");
  });

  it("does not accept arbitrary telemetry environment labels", () => {
    vi.stubEnv("EXPO_PUBLIC_MURMUR_ENV", "customer-secret");
    vi.stubEnv("NODE_ENV", "production");
    expect(getMurmurEnvironment()).toBe("production");
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

  it("selects an explicitly isolated offering", () => {
    vi.stubEnv("EXPO_PUBLIC_REVENUECAT_OFFERING_ID", " sandbox ");
    expect(getRevenueCatOfferingId()).toBe("sandbox");
  });

  it("omits empty store keys", () => {
    vi.stubEnv("EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY", "");
    vi.stubEnv("EXPO_PUBLIC_REVENUECAT_IOS_API_KEY", "  ");

    expect(getRevenueCatApiKeys()).toEqual({ android: undefined, ios: undefined });
  });
});

describe("UI preview config", () => {
  it("accepts only the deterministic development preview screens", () => {
    vi.stubEnv("EXPO_PUBLIC_MURMUR_UI_PREVIEW", "billing");
    expect(getUiPreviewScreen()).toBe("billing");

    vi.stubEnv("EXPO_PUBLIC_MURMUR_UI_PREVIEW", "picker");
    expect(getUiPreviewScreen()).toBe("picker");

    vi.stubEnv("EXPO_PUBLIC_MURMUR_UI_PREVIEW", "settings");
    expect(getUiPreviewScreen()).toBe("settings");

    vi.stubEnv("EXPO_PUBLIC_MURMUR_UI_PREVIEW", "translation");
    expect(getUiPreviewScreen()).toBe("translation");

    vi.stubEnv("EXPO_PUBLIC_MURMUR_UI_PREVIEW", "translation-muted");
    expect(getUiPreviewScreen()).toBe("translation-muted");

    vi.stubEnv("EXPO_PUBLIC_MURMUR_UI_PREVIEW", "out-of-minutes");
    expect(getUiPreviewScreen()).toBe("out-of-minutes");

    vi.stubEnv("EXPO_PUBLIC_MURMUR_UI_PREVIEW", "welcome");
    expect(getUiPreviewScreen()).toBe("welcome");

    vi.stubEnv("EXPO_PUBLIC_MURMUR_UI_PREVIEW", "other");
    expect(getUiPreviewScreen()).toBeNull();
  });
});
