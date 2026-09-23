import { beforeEach, describe, expect, it, vi } from "vitest";

const storage = vi.hoisted(() => new Map<string, string>());

vi.mock("./auth/client", () => ({
  authenticatedWorkerHeaders: vi.fn(async (headers: HeadersInit) => headers),
}));
vi.mock("./config", () => ({ getWorkerBaseUrl: () => "https://murmur.test" }));
vi.mock("./localStorage", () => ({
  deleteLocalValue: vi.fn(async (key: string) => { storage.delete(key); }),
  getLocalValue: vi.fn(async (key: string) => storage.get(key) ?? null),
  setLocalValue: vi.fn(async (key: string, value: string) => { storage.set(key, value); }),
}));

import { getInsightsConsent, setInsightsConsent } from "./insightsConsent";

beforeEach(() => {
  storage.clear();
  vi.unstubAllGlobals();
});

describe("insights consent", () => {
  it("starts unchosen and saves an explicit choice after the worker accepts it", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(getInsightsConsent()).resolves.toBeNull();
    await setInsightsConsent(true);
    await expect(getInsightsConsent()).resolves.toBe(true);
    expect(fetchMock.mock.calls[0][0]).toBe("https://murmur.test/v3/insights/consent");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ insights_consent: true });
  });

  it("does not claim consent when the worker rejects the choice", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 503 })));
    await expect(setInsightsConsent(true)).rejects.toThrow("insights_consent_http_503");
    await expect(getInsightsConsent()).resolves.toBeNull();
  });
});
