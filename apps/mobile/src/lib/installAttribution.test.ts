import { createServer } from "node:http";

import * as Sentry from "@sentry/react-native";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => {
  const storage = new Map<string, string>();
  return {
    getAdServicesAttributionToken: vi.fn(async () => "unused"),
    getInstallReferrer: vi.fn(async () => "utm_source=google"),
    getLocalValue: vi.fn(async (key: string) => storage.get(key) ?? null),
    getOrCreateInstallId: vi.fn(async () => "install_12345678"),
    platform: "android",
    setLocalValue: vi.fn(async (key: string, value: string) => { storage.set(key, value); }),
    storage,
    workerBaseUrl: "https://murmur.test",
  };
});

vi.mock("@sentry/react-native", () => ({ captureException: vi.fn(), captureMessage: vi.fn() }));
vi.mock("expo-application", () => ({ getInstallReferrerAsync: state.getInstallReferrer }));
vi.mock("react-native", () => ({ Platform: { get OS() { return state.platform; } } }));
vi.mock("../../modules/murmur-audio", () => ({
  default: { getAdServicesAttributionToken: state.getAdServicesAttributionToken },
}));
vi.mock("./config", () => ({ getWorkerBaseUrl: () => state.workerBaseUrl }));
vi.mock("./auth/client", () => ({ authenticatedWorkerHeaders: vi.fn(async () => ({})) }));
vi.mock("./installIdentity", () => ({ getOrCreateInstallId: state.getOrCreateInstallId }));
vi.mock("./localStorage", () => ({
  getLocalValue: state.getLocalValue,
  setLocalValue: state.setLocalValue,
}));

import { captureInstallAttribution } from "./installAttribution";
import { sanitizeMobileEvent } from "./observability/sentry";

beforeEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  state.storage.clear();
  state.platform = "android";
  state.workerBaseUrl = "https://murmur.test";
});

describe("install attribution", () => {
  it("sends the Play referrer only once after a successful first-launch upload", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await captureInstallAttribution(() => true);
    await captureInstallAttribution(() => true);

    expect(state.getInstallReferrer).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toMatchObject({
      platform: "android",
      referrer: "utm_source=google",
    });
  });

  it.each([400, 429, 503])("keeps HTTP %i in the sanitized failure without attribution content", async (status) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("private-response-body", { status })));

    await captureInstallAttribution(() => true);

    const [failure, context] = vi.mocked(Sentry.captureException).mock.calls[0] ?? [];
    const event = sanitizeMobileEvent({
      ...context,
      exception: { values: [{ value: failure instanceof Error ? failure.message : String(failure) }] },
      type: undefined,
    });
    expect(event.tags).toMatchObject({
      error_code: `install_attribution_http_${status}`,
      operation: "capture_install_attribution",
      attribution_step: "deliver",
    });
    expect(event.fingerprint).toEqual([
      "capture_install_attribution", "unknown", `install_attribution_http_${status}`,
    ]);
    expect(event.exception?.values?.[0]?.value).toBe("mobile_operation_failed");
    const serialized = JSON.stringify(event);
    for (const privateValue of ["private-response-body", "utm_source=google", "install_12345678", "https://murmur.test"]) {
      expect(serialized).not.toContain(privateValue);
    }
    expect(state.setLocalValue).not.toHaveBeenCalled();
  });

  it.each([
    [504, undefined, "unmarked"],
    [503, "v1", "worker_route"],
    [504, "private-unrecognized-marker", "unmarked"],
  ] as const)("reports bounded response provenance for HTTP %i and marker %s", async (status, marker, source) => {
    let requests = 0;
    const server = createServer((request, response) => {
      requests += 1;
      expect(request.url).toBe("/v3/attribution");
      request.resume();
      if (marker) response.setHeader("X-Murmur-Attribution-Response", marker);
      response.writeHead(status, { "Content-Type": "text/html" });
      response.end("private-response-body");
    });
    try {
      await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("Expected local HTTP address");
      state.workerBaseUrl = `http://127.0.0.1:${address.port}`;
      await captureInstallAttribution(() => true);
      const [failure, context] = vi.mocked(Sentry.captureException).mock.calls[0] ?? [];
      const event = sanitizeMobileEvent({
        ...context,
        exception: { values: [{ value: failure instanceof Error ? failure.message : String(failure) }] },
        type: undefined,
      });
      expect(event.tags).toMatchObject({
        attribution_step: "deliver",
        attribution_response: source,
        error_code: `install_attribution_http_${status}`,
      });
      expect(event.fingerprint).toEqual([
        "capture_install_attribution", "unknown", `install_attribution_http_${status}`,
      ]);
      for (const privateValue of ["private", "utm_source", "install_12345678", "127.0.0.1"]) {
        expect(JSON.stringify(event)).not.toContain(privateValue);
      }
      expect(requests).toBe(1);
      expect(state.setLocalValue).not.toHaveBeenCalled();
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) => server.close((failure) => failure ? reject(failure) : resolve()));
    }
  });

  it("does not classify arbitrary failure messages as HTTP diagnostics", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error(
      "install_attribution_http_503 private-attribution-token https://private.test",
    )));

    await captureInstallAttribution(() => true);

    const [failure, context] = vi.mocked(Sentry.captureException).mock.calls[0] ?? [];
    const event = sanitizeMobileEvent({
      ...context,
      exception: { values: [{ value: failure instanceof Error ? failure.message : String(failure) }] },
      type: undefined,
    });
    expect(event.tags).toMatchObject({ error_code: "none" });
    expect(JSON.stringify(event)).not.toContain("private");
    expect(state.setLocalValue).not.toHaveBeenCalled();
  });

  it.each([
    ["ERR_APPLICATION_INSTALL_REFERRER", "General error retrieving the install referrer: response code 1", "service_unavailable"],
    ["ERR_APPLICATION_INSTALL_REFERRER", "General error retrieving the install referrer: response code 3", "developer_error"],
    ["ERR_APPLICATION_INSTALL_REFERRER_UNAVAILABLE", "private message", "feature_not_supported"],
    ["ERR_APPLICATION_INSTALL_REFERRER_SERVICE_DISCONNECTED", "private message", "service_disconnected"],
    ["ERR_APPLICATION_INSTALL_REFERRER_REMOTE_EXCEPTION", "private message", "remote_exception"],
    ["ERR_APPLICATION_INSTALL_REFERRER", "General error retrieving the install referrer: response code 2", "unknown"],
    ["ERR_APPLICATION_INSTALL_REFERRER", "General error retrieving the install referrer: response code -1", "unknown"],
    ["ERR_APPLICATION_INSTALL_REFERRER", "General error retrieving the install referrer: response code 99", "unknown"],
    ["ERR_APPLICATION_INSTALL_REFERRER", "General error retrieving the install referrer: response code 1\\nprivate token", "unknown"],
    ["ERR_APPLICATION_INSTALL_REFERRER", "private token https://private.test", "unknown"],
    ["OTHER_NATIVE_CODE", "General error retrieving the install referrer: response code 1", "unknown"],
  ])("retains only safe Android diagnostics for %s / %s", async (code, message, response) => {
    const nativeFailure = Object.assign(new Error(message), { code });
    state.getInstallReferrer.mockRejectedValueOnce(nativeFailure);
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await captureInstallAttribution(() => true);

    const [failure, context] = vi.mocked(Sentry.captureException).mock.calls[0] ?? [];
    const event = sanitizeMobileEvent({
      ...context,
      extra: { referrer: "private token", installId: "install_12345678" },
      exception: { values: [{ value: failure instanceof Error ? failure.message : String(failure) }] },
      type: undefined,
    });
    expect(failure).toBe(nativeFailure);
    expect(event.tags).toMatchObject({
      error_code: code,
      operation: "capture_install_attribution",
      attribution_step: "android_referrer",
      install_referrer_response: response,
    });
    expect(event.fingerprint).toEqual(["capture_install_attribution", "unknown", code]);
    for (const privateValue of [message, "private", "install_12345678", "utm_source=google", "https://murmur.test"]) {
      expect(JSON.stringify(event)).not.toContain(privateValue);
    }
    expect(fetchMock).not.toHaveBeenCalled();
    expect(state.setLocalValue).not.toHaveBeenCalled();

    await captureInstallAttribution(() => true);

    expect(state.getInstallReferrer).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(state.setLocalValue).toHaveBeenCalledOnce();
  });

  it("does not infer a native response from an identity failure", async () => {
    state.getOrCreateInstallId.mockRejectedValueOnce(Object.assign(new Error(
      "General error retrieving the install referrer: response code 1",
    ), { code: "ERR_APPLICATION_INSTALL_REFERRER" }));

    await captureInstallAttribution(() => true);

    const [, context] = vi.mocked(Sentry.captureException).mock.calls[0] ?? [];
    expect(context).toMatchObject({ tags: { attribution_step: "install_identity" } });
    expect(context).not.toHaveProperty("tags.install_referrer_response");
    expect(state.getInstallReferrer).not.toHaveBeenCalled();
  });

  it.each([new Error("private token"), { code: "ERR_APPLICATION_INSTALL_REFERRER", message: "private token" }, null])(
    "keeps unrecognized native failures private and unknown: %s", async (nativeFailure) => {
      state.getInstallReferrer.mockRejectedValueOnce(nativeFailure);

      await captureInstallAttribution(() => true);

      const context = nativeFailure instanceof Error
        ? vi.mocked(Sentry.captureException).mock.calls[0]?.[1]
        : vi.mocked(Sentry.captureMessage).mock.calls[0]?.[1];
      expect(context).toMatchObject({ tags: {
        attribution_step: "android_referrer", install_referrer_response: "unknown", error_code: "none",
      } });
      expect(JSON.stringify(context)).not.toContain("private");
      expect(state.setLocalValue).not.toHaveBeenCalled();
    },
  );

  it("does not read or send attribution without analytics consent", async () => {
    await captureInstallAttribution(() => false);
    expect(state.getOrCreateInstallId).not.toHaveBeenCalled();
    expect(state.getInstallReferrer).not.toHaveBeenCalled();
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it.each(["ios", "android"])("does not deliver attribution when analytics is disabled during %s token collection", async (platform) => {
    state.platform = platform;
    let resolveToken = (_token: string): void => undefined;
    const collectToken = platform === "ios" ? state.getAdServicesAttributionToken : state.getInstallReferrer;
    collectToken.mockImplementationOnce(() => new Promise((resolve) => {
      resolveToken = resolve;
    }));
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    let analyticsEnabled = true;

    const pending = captureInstallAttribution(() => analyticsEnabled);
    await vi.waitFor(() => expect(collectToken).toHaveBeenCalledOnce());
    analyticsEnabled = false;
    resolveToken("attribution-token");
    await pending;

    expect(fetchMock).not.toHaveBeenCalled();
    expect(state.setLocalValue).not.toHaveBeenCalled();
  });
});
