import { afterEach, describe, expect, it, vi } from "vitest";

import { sanitizeWorkerEvent } from "../observability/sentry";

const sentry = vi.hoisted(() => ({ captureException: vi.fn() }));
vi.mock("@sentry/cloudflare", () => sentry);

import { captureInstallAttribution, parsePlayReferrer } from "./attribution";

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.clearAllMocks(); });

describe("install attribution", () => {
  it("marks route-generated rejection responses without reflecting request content", async () => {
    const response = await captureInstallAttribution(new Request("https://murmur.test/v3/attribution", {
      method: "POST", body: "private-invalid-body",
    }), {});
    expect(response.status).toBe(400);
    expect(response.headers.get("X-Murmur-Attribution-Response")).toBe("v1");
    expect(await response.text()).toBe('{"error":"invalid_attribution"}');
  });

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
    expect(response.headers.get("X-Murmur-Attribution-Response")).toBe("v1");
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

describe("Apple attribution readiness retries", () => {
  it.each([1, 2])("recovers after %i not-ready responses without duplicate analytics", async (notReadyCount) => {
    vi.useFakeTimers();
    const cancelled = vi.fn();
    const attempts: number[] = [];
    const analytics: string[] = [];
    const provider = vi.fn(async (url: string, init?: RequestInit) => {
      if (url !== "https://api-adservices.apple.com/api/v1/") {
        analytics.push(String(init?.body));
        return new Response(null);
      }
      attempts.push(Date.now());
      return attempts.length <= notReadyCount
        ? new Response(new ReadableStream({ cancel: cancelled }), { status: 404 })
        : Response.json({ attribution: true, campaignId: 123 });
    });
    vi.stubGlobal("fetch", provider);
    const pending: Promise<unknown>[] = [];
    const delivery = captureInstallAttribution(iosRequest(), { POSTHOG_PROJECT_TOKEN: "phc_test" }, {
      waitUntil: (promise) => void pending.push(promise),
    });
    await vi.waitFor(() => expect(cancelled).toHaveBeenCalledOnce());
    for (let attempt = 0; attempt < notReadyCount; attempt += 1) {
      await vi.advanceTimersByTimeAsync(attempts[0] + (attempt + 1) * 5_000 - Date.now() - 1);
      expect(attempts).toHaveLength(attempt + 1);
      expect(analytics).toHaveLength(0);
      await vi.advanceTimersByTimeAsync(1);
    }
    expect((await delivery).status).toBe(200);
    await Promise.all(pending);
    expect(attempts.map((time) => time - attempts[0])).toEqual(notReadyCount === 1 ? [0, 5_000] : [0, 5_000, 10_000]);
    expect(cancelled).toHaveBeenCalledTimes(notReadyCount);
    expect(analytics).toHaveLength(1);
    expect(analytics[0]).toContain("apple_ads");
    expect(analytics[0]).not.toContain("PRIVATE");
    expect(sentry.captureException).not.toHaveBeenCalled();
  });

  it("fails after three persistent 404s, releases each body, and never fabricates organic attribution", async () => {
    vi.useFakeTimers();
    const cancelled = vi.fn();
    const provider = vi.fn(async () => new Response(new ReadableStream({ cancel: cancelled }), { status: 404 }));
    vi.stubGlobal("fetch", provider);
    const delivery = captureInstallAttribution(iosRequest(), { POSTHOG_PROJECT_TOKEN: "phc_test" });
    await vi.waitFor(() => expect(provider).toHaveBeenCalledOnce());
    await vi.advanceTimersByTimeAsync(10_000);
    const response = await delivery;
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "attribution_unavailable" });
    await vi.advanceTimersByTimeAsync(60_000);
    expect(provider).toHaveBeenCalledTimes(3);
    expect(cancelled).toHaveBeenCalledTimes(3);
    expect(sentry.captureException).toHaveBeenCalledOnce();
    const [error, hint] = sentry.captureException.mock.calls[0];
    expect(error.code).toBe("attribution.apple_http_failed");
    expect(hint.tags.upstream_status).toBe("404");
  });

  it("does not let failed body cleanup mask a non-404 or trigger retries", async () => {
    const cancelled = vi.fn(async () => { throw new Error("PRIVATE_CLEANUP"); });
    const provider = vi.fn(async () => new Response(new ReadableStream({ cancel: cancelled }), { status: 401 }));
    vi.stubGlobal("fetch", provider);
    expect((await captureInstallAttribution(iosRequest(), {})).status).toBe(503);
    expect(provider).toHaveBeenCalledOnce();
    expect(cancelled).toHaveBeenCalledOnce();
    const [error, hint] = sentry.captureException.mock.calls[0];
    expect(String(error)).not.toContain("PRIVATE");
    expect(hint.tags.upstream_status).toBe("401");
  });

  it("bounds slow attempts, including the response body, without retrying a deadline failure", async () => {
    vi.useFakeTimers();
    const deadlines: number[] = [];
    vi.spyOn(AbortSignal, "timeout").mockImplementation((milliseconds) => {
      deadlines.push(milliseconds);
      const deadline = new AbortController();
      setTimeout(() => deadline.abort(new DOMException("PRIVATE_TIMEOUT", "TimeoutError")), milliseconds);
      return deadline.signal;
    });
    let attempts = 0;
    let startedAt = 0;
    vi.stubGlobal("fetch", vi.fn((_url: string, init?: RequestInit) => {
      attempts += 1;
      if (attempts === 1) startedAt = Date.now();
      if (attempts < 3) return new Promise<Response>((resolve) => {
        setTimeout(() => resolve(new Response(null, { status: 404 })), 9_999);
      });
      return Promise.resolve(new Response(new ReadableStream({ start(controller) {
        init?.signal?.addEventListener("abort", () => controller.error(init.signal?.reason), { once: true });
      } })));
    }));
    const delivery = captureInstallAttribution(iosRequest(), {});
    await vi.waitFor(() => expect(attempts).toBe(1));
    let settled = false;
    void delivery.then(() => { settled = true; });
    await vi.advanceTimersByTimeAsync(startedAt + 39_997 - Date.now());
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect((await delivery).status).toBe(503);
    expect(attempts).toBe(3);
    expect(deadlines).toEqual([10_000, 10_000, 10_000]);
    const [error] = sentry.captureException.mock.calls[0];
    expect(error.code).toBe("attribution.apple_timeout");
  });
});

describe("attribution failure diagnostics through the route and Sentry sanitizer", () => {
  it.each([
    { upstream: () => new Response("PRIVATE_BODY", { status: 503 }), code: "attribution.apple_http_failed", operation: "apple_attribution_request", status: "503" },
    { upstream: () => new Response("PRIVATE_BODY", { status: 401 }), code: "attribution.apple_http_failed", operation: "apple_attribution_request", status: "401" },
    { upstream: () => Promise.reject(new DOMException("PRIVATE_TIMEOUT", "TimeoutError")), code: "attribution.apple_timeout", operation: "apple_attribution_request" },
    { upstream: () => Promise.reject(new TypeError("PRIVATE_NETWORK")), code: "attribution.apple_network_failed", operation: "apple_attribution_request" },
    { upstream: () => failedAppleBody(new DOMException("PRIVATE_BODY_TIMEOUT", "TimeoutError")), code: "attribution.apple_timeout", operation: "apple_attribution_request" },
    { upstream: () => failedAppleBody(new TypeError("PRIVATE_BODY_NETWORK")), code: "attribution.apple_network_failed", operation: "apple_attribution_request" },
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
    expect(sentry.captureException).toHaveBeenCalledOnce();
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

function failedAppleBody(failure: Error): Response {
  return new Response(new ReadableStream({ start: (controller) => controller.error(failure) }));
}

it("bounds limiter outage reports independently of the failed limiter", async () => {
  const clock = vi.spyOn(Date, "now").mockReturnValue(3_000_000_000_000);
  const namespace = {
    idFromName: () => ({ equals: () => true, toString: () => "fixture" }),
    get: () => ({ fetch: async () => Response.json({ ok: false, code: "rate_limiter_unavailable" }) }),
  };
  const request = () => captureInstallAttribution(iosRequest(), {
    // The fixture implements only the Durable Object methods used by this route.
    RATE_LIMITER: namespace as unknown as DurableObjectNamespace,
  });
  const responses = await Promise.all(Array.from({ length: 20 }, request));
  expect(responses.every((response) => response.status === 503)).toBe(true);
  expect(sentry.captureException).toHaveBeenCalledOnce();
  clock.mockReturnValue(3_000_000_059_999);
  expect((await request()).status).toBe(503);
  expect(sentry.captureException).toHaveBeenCalledOnce();
  clock.mockReturnValue(3_000_000_060_000);
  expect((await request()).status).toBe(503);
  expect(sentry.captureException).toHaveBeenCalledTimes(2);
});

it("recognizes a deadline that aborts Apple's response body", async () => {
  const deadline = new AbortController();
  vi.spyOn(AbortSignal, "timeout").mockReturnValue(deadline.signal);
  const response = new Response(new ReadableStream({ start: (controller) => {
    deadline.abort(new DOMException("PRIVATE_DEADLINE", "TimeoutError"));
    controller.error(new DOMException("PRIVATE_BODY_ABORT", "AbortError"));
  } }));
  vi.stubGlobal("fetch", vi.fn(async () => response));
  expect((await captureInstallAttribution(iosRequest(), {})).status).toBe(503);
  const [error, hint] = sentry.captureException.mock.calls[0];
  const event = sanitizeWorkerEvent({ type: undefined, tags: hint.tags, exception: { values: [{ value: String(error) }] } });
  expect(event.tags).toEqual({ failure_code: "attribution.apple_timeout", operation: "apple_attribution_request" });
  expect(JSON.stringify(event)).not.toContain("PRIVATE");
});
