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
  };
});

vi.mock("@sentry/react-native", () => ({ captureException: vi.fn() }));
vi.mock("expo-application", () => ({ getInstallReferrerAsync: state.getInstallReferrer }));
vi.mock("react-native", () => ({ Platform: { get OS() { return state.platform; } } }));
vi.mock("../../modules/murmur-audio", () => ({
  default: { getAdServicesAttributionToken: state.getAdServicesAttributionToken },
}));
vi.mock("./config", () => ({ getWorkerBaseUrl: () => "https://murmur.test" }));
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

  it("does not deliver attribution when analytics is disabled during token collection", async () => {
    state.platform = "ios";
    let resolveToken = (_token: string): void => undefined;
    state.getAdServicesAttributionToken.mockImplementationOnce(() => new Promise((resolve) => {
      resolveToken = resolve;
    }));
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    let analyticsEnabled = true;

    const pending = captureInstallAttribution(() => analyticsEnabled);
    await vi.waitFor(() => expect(state.getAdServicesAttributionToken).toHaveBeenCalledOnce());
    analyticsEnabled = false;
    resolveToken("attribution-token");
    await pending;

    expect(fetchMock).not.toHaveBeenCalled();
    expect(state.setLocalValue).not.toHaveBeenCalled();
  });
});
