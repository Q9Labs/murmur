import { afterEach, describe, expect, it, vi } from "vitest";

import { appConfig, defaultServerConfig, getServerConfig, isBelowMinimumVersion } from "./serverConfig";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("server configuration", () => {
  it("defaults to no source transcript and a five-minute free grant", () => {
    const config = defaultServerConfig({});
    expect(config.source_transcript).toBe(false);
    expect(config.free_allowance_minutes).toBe(5);
    expect(config.max_session_seconds).toBe(300);
    expect(config.insights_model).toBe("openai/gpt-6-luna");
  });

  it("evaluates typed flags with the worker telemetry identity", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      featureFlags: {
        free_allowance_minutes: true,
        source_transcript: true,
        max_session_seconds: true,
        sessions_enabled: true,
      },
      featureFlagPayloads: {
        free_allowance_minutes: "7",
        max_session_seconds: "240",
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
    expect(config.max_session_seconds).toBe(240);
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
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
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
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
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
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
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

  it("compares dotted app versions numerically", () => {
    expect(isBelowMinimumVersion("1.2.9", "1.2.10")).toBe(true);
    expect(isBelowMinimumVersion("1.3", "1.2.10")).toBe(false);
    expect(isBelowMinimumVersion(null, "1.2.10")).toBe(true);
    expect(isBelowMinimumVersion("unknown", "1.2.10")).toBe(true);
    expect(isBelowMinimumVersion("1..2", "1.2.10")).toBe(true);
    expect(isBelowMinimumVersion(null, null)).toBe(false);
  });
});
