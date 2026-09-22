import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@sentry/cloudflare", () => ({ captureException: vi.fn() }));
vi.mock("../auth/auth", () => ({
  getMurmurSession: vi.fn(async () => ({ user: { id: "customer-123", isAnonymous: false } })),
}));
vi.mock("../billing/revenueCatReconciliation", () => ({
  reconcileRevenueCatCustomer: vi.fn(),
}));
vi.mock("../observability/posthog", () => ({ queuePostHogEvent: vi.fn() }));

import { reconcileRevenueCatCustomer } from "../billing/revenueCatReconciliation";
import { queuePostHogEvent } from "../observability/posthog";
import { hashInstallId } from "../privacy";
import { reconcileBilling } from "./reconcileBilling";

const env = {
  BILLING_FULFILLMENT_ENABLED: "true",
  SESSION_HASH_SALT: "test-salt",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("billing reconciliation telemetry identity", () => {
  it("hashes the customer ID on success", async () => {
    vi.mocked(reconcileRevenueCatCustomer).mockResolvedValueOnce({
      purchaseCount: 2,
      subscriptionCount: 1,
    });

    const response = await reconcileBilling(
      new Request("https://worker.example.test/v3/billing/reconcile", {
        body: JSON.stringify({ analytics_enabled: true }),
        method: "POST",
      }),
      env,
    );

    expect(response.status).toBe(200);
    expect(queuePostHogEvent).toHaveBeenCalledWith(expect.objectContaining({
      distinct_id: `customer_${await hashInstallId("customer-123", "test-salt")}`,
      payload: expect.objectContaining({ status: "succeeded" }),
    }));
  });

  it("hashes the customer ID on failure", async () => {
    vi.mocked(reconcileRevenueCatCustomer).mockRejectedValueOnce(new Error("provider unavailable"));

    const response = await reconcileBilling(
      new Request("https://worker.example.test/v3/billing/reconcile", {
        body: JSON.stringify({ analytics_enabled: true }),
        method: "POST",
      }),
      env,
    );

    expect(response.status).toBe(503);
    expect(queuePostHogEvent).toHaveBeenCalledWith(expect.objectContaining({
      distinct_id: `customer_${await hashInstallId("customer-123", "test-salt")}`,
      payload: expect.objectContaining({ status: "failed" }),
    }));
  });

  it.each([undefined, false])("does not capture when analytics is %s", async (enabled) => {
    vi.mocked(reconcileRevenueCatCustomer).mockResolvedValueOnce({
      purchaseCount: 0,
      subscriptionCount: 0,
    });

    const response = await reconcileBilling(
      new Request("https://worker.example.test/v3/billing/reconcile", {
        body: enabled === undefined ? undefined : JSON.stringify({ analytics_enabled: enabled }),
        method: "POST",
      }),
      env,
    );

    expect(response.status).toBe(200);
    expect(queuePostHogEvent).not.toHaveBeenCalled();
  });

  it("does not capture a failed reconciliation without explicit analytics consent", async () => {
    vi.mocked(reconcileRevenueCatCustomer).mockRejectedValueOnce(new Error("provider unavailable"));

    const response = await reconcileBilling(
      new Request("https://worker.example.test/v3/billing/reconcile", { method: "POST" }),
      env,
    );

    expect(response.status).toBe(503);
    expect(queuePostHogEvent).not.toHaveBeenCalled();
  });
});
