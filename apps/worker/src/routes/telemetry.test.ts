import { afterEach, describe, expect, it, vi } from "vitest";

import { captureMobileTelemetry } from "./telemetry";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("mobile telemetry route", () => {
  it("hashes identity and forwards only an allowlisted event to PostHog US", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const pending: Promise<unknown>[] = [];
    const response = await captureMobileTelemetry(
      new Request("https://murmur.test/v1/telemetry", {
        body: JSON.stringify({
          app_install_id: "install_12345678",
          payload: {
            app_version: "1.2.0",
            build_number: "10",
            event: "mobile_app_opened",
            platform: "ios",
          },
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      }),
      {
        MURMUR_ENV: "test",
        POSTHOG_PROJECT_TOKEN: "phc_test",
        SESSION_HASH_SALT: "test-salt",
      },
      { waitUntil: (promise) => void pending.push(promise) },
    );
    await Promise.all(pending);

    expect(response.status).toBe(202);
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://us.i.posthog.com/i/v0/e/");
    const payload = JSON.parse(String(init.body));
    expect(payload).toMatchObject({
      api_key: "phc_test",
      event: "mobile_app_opened",
      properties: {
        $geoip_disable: true,
        $ip: null,
        $process_person_profile: false,
        component: "mobile",
        product: "murmur",
      },
    });
    expect(payload.properties.distinct_id).not.toContain("install_12345678");
    expect(JSON.stringify(payload)).not.toContain("source_caption");
    expect(JSON.stringify(payload)).not.toContain("translated_caption");
  });

  it("rejects unknown payloads before forwarding", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const response = await captureMobileTelemetry(
      new Request("https://murmur.test/v1/telemetry", {
        body: JSON.stringify({
          app_install_id: "install_12345678",
          payload: { event: "capture_conversation", transcript: "private" },
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      }),
      { POSTHOG_PROJECT_TOKEN: "phc_test" },
    );

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
