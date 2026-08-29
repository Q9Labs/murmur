import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  captureMobileFailure: vi.fn(),
  deleteAnonymousAnalyticsPreference: vi.fn(async () => undefined),
  getAnonymousAnalyticsEnabled: vi.fn(async () => true),
  getOrCreateInstallId: vi.fn(async () => "install-id-123456"),
  setAnonymousAnalyticsEnabled: vi.fn(async () => undefined),
}));

vi.mock("expo-constants", () => ({
  default: {
    expoConfig: {
      ios: { buildNumber: "10" },
      version: "1.2.0",
    },
  },
}));
vi.mock("react-native", () => ({ Platform: { OS: "ios" } }));
vi.mock("./anonymousAnalytics", () => ({
  deleteAnonymousAnalyticsPreference: dependencies.deleteAnonymousAnalyticsPreference,
  getAnonymousAnalyticsEnabled: dependencies.getAnonymousAnalyticsEnabled,
  setAnonymousAnalyticsEnabled: dependencies.setAnonymousAnalyticsEnabled,
}));
vi.mock("./config", () => ({ getWorkerBaseUrl: () => "https://murmur.test" }));
vi.mock("./installIdentity", () => ({
  getOrCreateInstallId: dependencies.getOrCreateInstallId,
}));
vi.mock("./observability/sentry", () => ({
  captureMobileFailure: dependencies.captureMobileFailure,
}));

import {
  captureMobileTelemetry,
  initializeAnonymousAnalytics,
  resetAnonymousAnalyticsPreference,
  updateAnonymousAnalyticsEnabled,
} from "./telemetry";

const fetchMock = vi.fn<
  (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
>(async () => new Response(null, { status: 202 }));

beforeEach(async () => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
  dependencies.getAnonymousAnalyticsEnabled.mockResolvedValue(true);
  await resetAnonymousAnalyticsPreference();
  vi.clearAllMocks();
});

describe("mobile telemetry privacy preference", () => {
  it("does not send an app-open event after an existing opt-out", async () => {
    dependencies.getAnonymousAnalyticsEnabled.mockResolvedValueOnce(false);

    await expect(initializeAnonymousAnalytics()).resolves.toBe(false);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends only the closed app-open payload when analytics is enabled", async () => {
    await expect(initializeAnonymousAnalytics()).resolves.toBe(true);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(body).toEqual({
      app_install_id: "install-id-123456",
      payload: {
        app_version: "1.2.0",
        build_number: "10",
        event: "mobile_app_opened",
        platform: "ios",
      },
    });
    expect(JSON.stringify(body)).not.toMatch(/audio|caption|conversation|transcript/);
  });

  it("records the opt-out once and suppresses later product events", async () => {
    await updateAnonymousAnalyticsEnabled(false);
    captureMobileTelemetry({
      event: "mobile_listen_tapped",
      network_type: "wifi",
      playback_enabled: true,
      source_language: "en",
      target_language: "ar",
    });
    await Promise.resolve();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(dependencies.setAnonymousAnalyticsEnabled).toHaveBeenCalledWith(false);
    expect(String(fetchMock.mock.calls[0]?.[1]?.body)).toContain(
      '"event":"mobile_analytics_preference_changed"',
    );
  });

  it("keeps analytics off when opt-out delivery fails", async () => {
    fetchMock.mockRejectedValueOnce(new Error("network unavailable"));

    await expect(updateAnonymousAnalyticsEnabled(false)).resolves.toBeUndefined();
    captureMobileTelemetry({
      event: "mobile_listen_tapped",
      network_type: "wifi",
      playback_enabled: true,
      source_language: "en",
      target_language: "ar",
    });
    await Promise.resolve();

    expect(dependencies.setAnonymousAnalyticsEnabled).toHaveBeenCalledWith(false);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(dependencies.captureMobileFailure).toHaveBeenCalledOnce();
  });
});
