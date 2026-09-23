import { beforeEach, describe, expect, it, vi } from "vitest";

const storage = vi.hoisted(() => new Map<string, string>());
const referrer = vi.hoisted(() => vi.fn(async () => "utm_source=google"));

vi.mock("expo-application", () => ({ getInstallReferrerAsync: referrer }));
vi.mock("react-native", () => ({ Platform: { OS: "android" } }));
vi.mock("@sentry/react-native", () => ({ captureException: vi.fn() }));
vi.mock("../../modules/murmur-audio", () => ({
  default: { getAdServicesAttributionToken: vi.fn(async () => "unused") },
}));
vi.mock("./config", () => ({ getWorkerBaseUrl: () => "https://murmur.test" }));
vi.mock("./auth/client", () => ({ authenticatedWorkerHeaders: vi.fn(async () => ({})) }));
vi.mock("./installIdentity", () => ({ getOrCreateInstallId: vi.fn(async () => "install_12345678") }));
vi.mock("./localStorage", () => ({
  getLocalValue: vi.fn((key: string) => Promise.resolve(storage.get(key) ?? null)),
  setLocalValue: vi.fn((key: string, value: string) => {
    storage.set(key, value);
    return Promise.resolve();
  }),
}));

import { captureInstallAttribution } from "./installAttribution";

beforeEach(() => {
  storage.clear();
  referrer.mockClear();
  vi.unstubAllGlobals();
});

describe("install attribution", () => {
  it("sends the Play referrer only once after a successful first-launch upload", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await captureInstallAttribution();
    await captureInstallAttribution();
    expect(referrer).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      platform: "android",
      referrer: "utm_source=google",
    });
  });
});
