import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../auth/auth", () => ({
  getMurmurSession: vi.fn(),
}));
vi.mock("../billing/revenueCatWebhookVerification", () => ({
  verifyRevenueCatWebhook: vi.fn(),
}));

import { getMurmurSession } from "../auth/auth";
import { verifyRevenueCatWebhook } from "../billing/revenueCatWebhookVerification";
import { getCustomer } from "./customer";
import { reconcileBilling } from "./reconcileBilling";
import { receiveRevenueCatWebhook } from "./revenueCatWebhook";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getMurmurSession).mockResolvedValue(null);
  vi.mocked(verifyRevenueCatWebhook).mockResolvedValue(false);
});

describe("billing routes", () => {
  it("requires a durable account for customer state", async () => {
    const response = await getCustomer(
      new Request("https://worker.example.test/v3/customer"),
      {},
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "authentication_required" });
  });

  it("requires a durable account before reconciliation", async () => {
    const response = await reconcileBilling(
      new Request("https://worker.example.test/v3/billing/reconcile", { method: "POST" }),
      {},
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "authentication_required" });
  });

  it("rejects unsigned RevenueCat webhooks", async () => {
    const response = await receiveRevenueCatWebhook(
      new Request("https://worker.example.test/v3/webhooks/revenuecat", {
        body: "{}",
        method: "POST",
      }),
      {},
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "invalid_webhook_signature" });
  });

  it("rejects oversized webhook bodies before signature verification", async () => {
    const response = await receiveRevenueCatWebhook(
      new Request("https://worker.example.test/v3/webhooks/revenuecat", {
        body: "x".repeat(257 * 1_024),
        method: "POST",
      }),
      {},
    );

    expect(response.status).toBe(413);
    expect(verifyRevenueCatWebhook).not.toHaveBeenCalled();
  });
});
