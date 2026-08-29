import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../auth/client", () => ({
  authenticatedWorkerHeaders: vi.fn(async (headers?: HeadersInit) => new Headers(headers)),
}));
vi.mock("../config", () => ({
  getWorkerBaseUrl: () => "https://worker.example.test",
}));

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
        headers: expect.any(Headers),
        method: "POST",
      }),
    );
    const reconciliationHeaders = fetchMock.mock.calls[1]?.[1]?.headers;
    expect(reconciliationHeaders).toBeInstanceOf(Headers);
    expect(reconciliationHeaders?.get("x-murmur-reconciliation-trigger")).toBe("restore");
  });
});
