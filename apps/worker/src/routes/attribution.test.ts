import { afterEach, describe, expect, it, vi } from "vitest";

import { captureInstallAttribution, parsePlayReferrer } from "./attribution";

afterEach(() => vi.unstubAllGlobals());

describe("install attribution", () => {
  it("allows only normalized Play campaign values", () => {
    expect(parsePlayReferrer("utm_source=google&utm_campaign=summer-26"))
      .toEqual({ source: "google", campaignId: "summer-26" });
    expect(parsePlayReferrer("utm_source=private%20words&utm_campaign=bad%20value"))
      .toEqual({ source: "google_play", campaignId: null });
  });

  it("resolves iOS tokens server-side and never forwards the token to analytics", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ attribution: true, campaignId: 123 })))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const pending: Promise<unknown>[] = [];
    const response = await captureInstallAttribution(
      new Request("https://murmur.test/v3/attribution", {
        body: JSON.stringify({
          app_install_id: "install_12345678",
          platform: "ios",
          token: "private-attribution-token-123456789",
        }),
        method: "POST",
      }),
      { POSTHOG_PROJECT_TOKEN: "phc_test", SESSION_HASH_SALT: "test-salt" },
      { waitUntil: (promise) => void pending.push(promise) },
    );
    await Promise.all(pending);
    expect(response.status).toBe(200);
    expect(fetchMock.mock.calls[0][0]).toBe("https://api-adservices.apple.com/api/v1/");
    const analyticsBody = JSON.stringify(fetchMock.mock.calls[1][1].body);
    expect(analyticsBody).toContain("apple_ads");
    expect(analyticsBody).not.toContain("private-attribution-token");
  });
});
