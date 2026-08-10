import { afterEach, describe, expect, it, vi } from "vitest";

import { getUiPreviewScreen, getWorkerBaseUrl } from "./config";

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

describe("UI preview config", () => {
  it("accepts only the deterministic development preview screens", () => {
    vi.stubEnv("EXPO_PUBLIC_MURMUR_UI_PREVIEW", "translation");
    expect(getUiPreviewScreen()).toBe("translation");

    vi.stubEnv("EXPO_PUBLIC_MURMUR_UI_PREVIEW", "welcome");
    expect(getUiPreviewScreen()).toBe("welcome");

    vi.stubEnv("EXPO_PUBLIC_MURMUR_UI_PREVIEW", "other");
    expect(getUiPreviewScreen()).toBeNull();
  });
});
