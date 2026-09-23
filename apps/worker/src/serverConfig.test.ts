import { afterEach, describe, expect, it, vi } from "vitest";

import { appConfig, defaultServerConfig, getServerConfig, isBelowMinimumVersion, sessionLimitSeconds } from "./serverConfig";
import { posthogFlagsBody } from "./posthogFlagsFixture";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("server configuration", () => {
  it("defaults to no source transcript and a seven-minute free grant", () => {
    const config = defaultServerConfig({});
    expect(config.source_transcript).toBe(false);
    expect(config.insights_model).toBe("openai/gpt-6-luna");
    expect(config.free_allowance_minutes).toBe(7);
    expect(config.max_session_seconds_free).toBe(300);
    expect(config.max_session_seconds_paid).toBe(3600);
    expect(sessionLimitSeconds(config, "free")).toBe(300);
    expect(sessionLimitSeconds(config, "pro")).toBe(3600);
    expect(sessionLimitSeconds(config, "pro_max")).toBe(3600);
    expect(sessionLimitSeconds({ ...config, max_session_seconds_paid: 5000 }, "pro")).toBe(3600);
  });

  it("evaluates typed flags with the worker telemetry identity", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(posthogFlagsBody({
      featureFlags: {
        free_allowance_minutes: true,
        source_transcript: true,
        max_session_seconds_free: true,
        sessions_enabled: true,
      },
      featureFlagPayloads: {
        free_allowance_minutes: "7",
        max_session_seconds_free: "240",
        sessions_enabled: "false",
      },
    })));
    vi.stubGlobal("fetch", fetchMock);
    const config = await getServerConfig({ POSTHOG_PROJECT_TOKEN: "test-token" }, {
      appVersion: "1.2.3",
      distinctId: "anonymous_install_test-config",
      plan: "free",
      platform: "android",
    });
    expect(config.source_transcript).toBe(true);
    expect(config.max_session_seconds_free).toBe(240);
    expect(config.free_allowance_minutes).toBe(7);
    expect(config.sessions_enabled).toBe(false);
    const request = fetchMock.mock.calls[0]?.[1];
    expect(JSON.parse(request.body)).toMatchObject({
      distinct_id: "anonymous_install_test-config",
      person_properties: { app_platform: "android", app_version: "1.2.3", plan: "free" },
      token: "test-token",
    });
  });

  it("uses defaults for flags that don't match this user", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(posthogFlagsBody({
      featureFlags: { output_audio_enabled: false, sessions_enabled: false },
      featureFlagPayloads: {},
    }))));
    const config = await getServerConfig({ POSTHOG_PROJECT_TOKEN: "test-token" }, {
      appVersion: "1.2.3",
      distinctId: "anonymous_install_unmatched",
      plan: "free",
      platform: "ios",
    });
    expect(config.sessions_enabled).toBe(true);
    expect(config.output_audio_enabled).toBe(true);
  });

  it("parses personal-offer flags", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(posthogFlagsBody({
      featureFlags: {
        personal_offer_enabled: true,
        personal_offer_hours: true,
        personal_offer_offering_id: true,
      },
      featureFlagPayloads: {
        personal_offer_enabled: "true",
        personal_offer_hours: "24",
        personal_offer_offering_id: '"short_offer"',
      },
    }))));
    const config = await getServerConfig({ POSTHOG_PROJECT_TOKEN: "test-token" }, {
      appVersion: "1",
      distinctId: "anonymous_install_offers",
      plan: "free",
      platform: "ios",
    });
    expect(config).toMatchObject({
      personal_offer_enabled: true,
      personal_offer_hours: 24,
      personal_offer_offering_id: "short_offer",
    });
    expect(defaultServerConfig({})).toMatchObject({
      personal_offer_enabled: false,
      personal_offer_hours: 48,
      personal_offer_offering_id: "personal_offer",
    });
  });

  it("returns a personal offering only before its deadline", () => {
    const config = { ...defaultServerConfig({}), paywall_offering_id: "default" };
    const personalOffer = { offering_id: "personal_offer", expires_at: "2030-01-01T00:00:00.000Z" };
    expect(appConfig(config, personalOffer, Date.parse("2029-12-31T23:59:59Z"))).toMatchObject({
      paywall_offering_id: "personal_offer",
      personal_offer: personalOffer,
    });
    expect(appConfig(config, personalOffer, Date.parse(personalOffer.expires_at))).toMatchObject({
      paywall_offering_id: "default",
      personal_offer: null,
    });
  });

  it("falls back for malformed personal-offer payloads and accepts an explicit disabled flag", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(posthogFlagsBody({
      featureFlags: {
        personal_offer_enabled: true,
        personal_offer_hours: true,
        personal_offer_offering_id: true,
      },
      featureFlagPayloads: {
        personal_offer_enabled: "false",
        personal_offer_hours: "0",
        personal_offer_offering_id: '"  "',
      },
    }))));
    const config = await getServerConfig({ POSTHOG_PROJECT_TOKEN: "test-token" }, {
      appVersion: "1",
      distinctId: "anonymous_install_invalid_offers",
      plan: "free",
      platform: "ios",
    });
    expect(config).toMatchObject({
      personal_offer_enabled: false,
      personal_offer_hours: 48,
      personal_offer_offering_id: "personal_offer",
    });
  });

  it("reads PostHog's /flags response shape", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      errorsWhileComputingFlags: false,
      flags: {
        free_allowance_minutes: {
          enabled: true,
          key: "free_allowance_minutes",
          metadata: { description: null, has_experiment: false, id: 903399, payload: "7", version: 2 },
          reason: { code: "condition_match", condition_index: 0, description: "Matched condition set 1" },
          variant: null,
        },
      },
    }))));
    const config = await getServerConfig({ POSTHOG_PROJECT_TOKEN: "test-token" }, {
      appVersion: "1.2.3",
      distinctId: "anonymous_install_real_shape",
      plan: "free",
      platform: "ios",
    });
    expect(config.free_allowance_minutes).toBe(7);
  });

  it("compares dotted app versions numerically", () => {
    expect(isBelowMinimumVersion("1.2.9", "1.2.10")).toBe(true);
    expect(isBelowMinimumVersion("1.3", "1.2.10")).toBe(false);
    expect(isBelowMinimumVersion(null, "1.2.10")).toBe(true);
    expect(isBelowMinimumVersion("unknown", "1.2.10")).toBe(true);
    expect(isBelowMinimumVersion("1..2", "1.2.10")).toBe(true);
    expect(isBelowMinimumVersion(null, null)).toBe(false);
  });
});
