import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getDevTranslationModelRouteEnv,
  getWorkerBaseUrl,
  isUltravoxVadEnabledByDefault,
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

  it("centralizes public app experiment environment reads", () => {
    vi.stubEnv("EXPO_PUBLIC_MURMUR_DEV_MODEL_ROUTE", "experiment_ultravox_replacement");
    vi.stubEnv("EXPO_PUBLIC_MURMUR_ULTRAVOX_VAD", "off");

    expect(getDevTranslationModelRouteEnv()).toBe("experiment_ultravox_replacement");
    expect(isUltravoxVadEnabledByDefault()).toBe(false);
  });
});
