import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../auth/client", () => import("../__tests__/workerClientMocks"));
vi.mock("../anonymousAnalytics", () => ({ getAnonymousAnalyticsEnabled: vi.fn(async () => true) }));
vi.mock("../config", () => import("../__tests__/workerClientMocks"));

import { getAnonymousAnalyticsEnabled } from "../anonymousAnalytics";
import {
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
});
