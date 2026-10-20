import { afterEach, describe, expect, it, vi } from "vitest";

import { sanitizeWorkerEvent } from "../observability/sentry";

const sentry = vi.hoisted(() => ({ captureException: vi.fn() }));
vi.mock("@sentry/cloudflare", () => sentry);

import { captureInstallAttribution, parsePlayReferrer } from "./attribution";

afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

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

function iosRequest() {
  return new Request("https://murmur.test/v3/attribution", {
    method: "POST",
    headers: { "CF-Connecting-IP": "192.0.2.123" },
    body: JSON.stringify({ app_install_id: "PRIVATE_INSTALL", platform: "ios", token: "PRIVATE_TOKEN_123456789012345" }),
  });
}

describe("attribution failure diagnostics through the route and Sentry sanitizer", () => {
  it.each([
    { upstream: () => new Response("PRIVATE_BODY", { status: 503 }), code: "attribution.apple_http_failed", operation: "apple_attribution_request", status: "503" },
    { upstream: () => new Response("PRIVATE_BODY", { status: 401 }), code: "attribution.apple_http_failed", operation: "apple_attribution_request", status: "401" },
    { upstream: () => Promise.reject(new DOMException("PRIVATE_TIMEOUT", "TimeoutError")), code: "attribution.apple_timeout", operation: "apple_attribution_request" },
    { upstream: () => Promise.reject(new TypeError("PRIVATE_NETWORK")), code: "attribution.apple_network_failed", operation: "apple_attribution_request" },
    { upstream: () => new Response("PRIVATE_JSON"), code: "attribution.apple_invalid_response", operation: "apple_attribution_response" },
    { upstream: () => Response.json({ attribution: "PRIVATE_SCHEMA" }), code: "attribution.apple_invalid_response", operation: "apple_attribution_response" },
  ])("keeps $code with status $status but no content", async ({ upstream, code, operation, status }) => {
    const provider = vi.fn(async () => upstream());
    vi.stubGlobal("fetch", provider);
    const response = await captureInstallAttribution(iosRequest(), {});
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "attribution_unavailable" });
    expect(provider).toHaveBeenCalledOnce();
    expect(sentry.captureException).toHaveBeenCalledOnce();
    const [error, hint] = sentry.captureException.mock.calls[0];
    const event = sanitizeWorkerEvent({ type: undefined, tags: hint.tags, exception: { values: [{ value: String(error) }] } });
    expect(event.tags).toEqual({ failure_code: code, operation, ...(status ? { upstream_status: status } : {}) });
    expect(JSON.stringify(event)).not.toMatch(/PRIVATE|192\.0\.2\.123/);
  });

  it("distinguishes a limiter outage from Apple and leaves ordinary limits alone", async () => {
    const fetchProvider = vi.fn();
    vi.stubGlobal("fetch", fetchProvider);
    for (const code of ["rate_limiter_unavailable", "hourly_limit", "rate_limiter_invalid_response"]) {
      const namespace = {
        idFromName: () => ({ equals: () => true, toString: () => "fixture" }),
        get: () => ({ fetch: async () => Response.json({ ok: false, code }) }),
      };
      const response = await captureInstallAttribution(iosRequest(), {
        // The route only uses idFromName/get/fetch; this fixture omits unrelated Cloudflare APIs.
        RATE_LIMITER: namespace as unknown as DurableObjectNamespace,
      });
      expect(response.status).toBe(code === "hourly_limit" ? 429 : 503);
      expect(await response.json()).toEqual({ error: code });
    }
    expect(fetchProvider).not.toHaveBeenCalled();
    expect(sentry.captureException).toHaveBeenCalledTimes(2);
    const [, hint] = sentry.captureException.mock.calls[0];
    expect(sanitizeWorkerEvent({ type: undefined, tags: hint.tags }).tags).toEqual({
      failure_code: "attribution.rate_limiter_unavailable", operation: "attribution_rate_limit",
    });
  });
});


it("keeps organic iOS and Android attribution successful without exporting absent analytics consent", async () => {
  const provider = vi.fn(async () => Response.json({ attribution: false }));
  vi.stubGlobal("fetch", provider);
  const ios = await captureInstallAttribution(iosRequest(), {});
  const android = await captureInstallAttribution(new Request("https://murmur.test/v3/attribution", {
    method: "POST", body: JSON.stringify({ app_install_id: "android_fixture", platform: "android", referrer: "utm_source=google" }),
  }), {});
  expect(ios.status).toBe(200);
  expect(android.status).toBe(200);
  expect(provider).toHaveBeenCalledOnce();
  expect(sentry.captureException).not.toHaveBeenCalled();
});

it("rejects malformed attribution before contacting any provider or reporting a failure", async () => {
  const provider = vi.fn();
  vi.stubGlobal("fetch", provider);
  const response = await captureInstallAttribution(new Request("https://murmur.test/v3/attribution", { method: "POST", body: "{}" }), {});
  expect(response.status).toBe(400);
  expect(provider).not.toHaveBeenCalled();
  expect(sentry.captureException).not.toHaveBeenCalled();
});
