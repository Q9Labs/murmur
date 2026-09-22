import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../auth/client", () => import("../__tests__/workerClientMocks"));
vi.mock("../anonymousAnalytics", () => ({ getAnonymousAnalyticsEnabled: vi.fn(async () => true) }));
vi.mock("../config", () => import("../__tests__/workerClientMocks"));
vi.mock("../appRelease", () => ({
  getAppRelease: () => ({ app_platform: "ios", app_version: "1.2.3" }),
}));
vi.mock("../installIdentity", () => ({ getOrCreateInstallId: async () => "install-1" }));

import { getAnonymousAnalyticsEnabled } from "../anonymousAnalytics";
import {
  requestMurmurAppConfig,
  requestMurmurCustomer,
  requestMurmurReconciliation,
} from "./murmurBillingApi";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Murmur billing Worker adapter", () => {
  it("uses the authenticated customer and reconciliation routes", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    await requestMurmurCustomer();
    await requestMurmurReconciliation("restore");

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://worker.example.test/v3/customer",
      expect.objectContaining({ headers: expect.any(Headers) }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://worker.example.test/v3/billing/reconcile",
      expect.objectContaining({
        body: JSON.stringify({ analytics_enabled: true }),
        headers: expect.any(Headers),
        method: "POST",
      }),
    );
    const reconciliationHeaders = fetchMock.mock.calls[1]?.[1]?.headers;
    expect(reconciliationHeaders).toBeInstanceOf(Headers);
    expect(reconciliationHeaders?.get("x-murmur-reconciliation-trigger")).toBe("restore");
    expect(reconciliationHeaders?.get("Content-Type")).toBe("application/json");
  });

  it("sends the disabled analytics preference with reconciliation", async () => {
    vi.mocked(getAnonymousAnalyticsEnabled).mockResolvedValueOnce(false);
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    await requestMurmurReconciliation("login");

    expect(fetchMock.mock.calls[0]?.[1]?.body)
      .toBe(JSON.stringify({ analytics_enabled: false }));
  });

  it("reads app-facing server config from the authenticated config route", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({}));
    vi.stubGlobal("fetch", fetchMock);

    await requestMurmurAppConfig();

    expect(fetchMock).toHaveBeenCalledWith(
      "https://worker.example.test/v3/config",
      expect.objectContaining({ headers: expect.any(Headers) }),
    );
    const headers = fetchMock.mock.calls[0]?.[1]?.headers;
    expect(headers).toBeInstanceOf(Headers);
    expect(headers?.get("x-murmur-app-platform")).toBe("ios");
    expect(headers?.get("x-murmur-app-version")).toBe("1.2.3");
    expect(headers?.get("x-murmur-install-id")).toBe("install-1");
  });
});
