import { afterEach, describe, expect, it, vi } from "vitest";

import { defaultServerConfig, getServerConfig, isBelowMinimumVersion } from "./serverConfig";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("server configuration", () => {
  it("defaults to no source transcript and a five-minute free grant", () => {
    const config = defaultServerConfig({});
    expect(config.source_transcript).toBe(false);
    expect(config.free_allowance_minutes).toBe(5);
    expect(config.max_session_seconds).toBe(300);
  });

  it("evaluates typed flags with the worker telemetry identity", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      featureFlags: { source_transcript: true, max_session_seconds: true, sessions_enabled: false },
      featureFlagPayloads: { max_session_seconds: "240" },
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
    expect(config.sessions_enabled).toBe(false);
    const request = fetchMock.mock.calls[0]?.[1];
    expect(JSON.parse(request.body)).toMatchObject({
      distinct_id: "anonymous_install_test-config",
      person_properties: { app_platform: "android", app_version: "1.2.3", plan: "free" },
      token: "test-token",
    });
  });

  it("compares dotted app versions numerically", () => {
    expect(isBelowMinimumVersion("1.2.9", "1.2.10")).toBe(true);
    expect(isBelowMinimumVersion("1.3", "1.2.10")).toBe(false);
    expect(isBelowMinimumVersion(null, "1.2.10")).toBe(false);
  });
});
