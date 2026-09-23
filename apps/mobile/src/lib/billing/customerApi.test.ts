import { afterEach, describe, expect, it, vi } from "vitest";

const configRequest = vi.hoisted(() => vi.fn<() => Promise<Response>>());

vi.mock("../providers/murmurBillingApi", () => ({ requestMurmurAppConfig: configRequest }));

import { fetchMurmurAppConfig } from "./customerApi";
import { decodeCustomer } from "./customerResponse";

describe("decodeCustomer", () => {
  it("decodes a durable customer balance", () => {
    expect(decodeCustomer({
      balance: {
        allowance_ms: 1_800_000,
        available_ms: 1_800_000,
        credit_ms: 0,
        earliest_expiry_at_ms: 1_800_000_000_000,
        negative_ms: 0,
      },
      customer_id: "customer_1",
      is_registered: false,
      plan: "free",
      purchases_enabled: false,
    })).toEqual({
      allowanceMs: 1_800_000,
      availableMs: 1_800_000,
      creditMs: 0,
      customerId: "customer_1",
      earliestExpiryAtMs: 1_800_000_000_000,
      fulfillmentEnabled: true,
      isRegistered: false,
      negativeMs: 0,
      plan: "free",
      purchasesEnabled: false,
      revenueCatCustomerId: "customer_1",
    });
  });

  it("rejects malformed or negative allowance values", () => {
    expect(decodeCustomer(null)).toBeNull();
    expect(decodeCustomer({
      balance: {
        allowance_ms: -1,
        available_ms: -1,
        credit_ms: 0,
        earliest_expiry_at_ms: null,
        negative_ms: 1,
      },
      customer_id: "customer_1",
      is_registered: false,
      plan: "free",
      purchases_enabled: false,
    })).toBeNull();
  });

  it("rejects empty or oversized store identities", () => {
    const payload = {
      balance: {
        allowance_ms: 1,
        available_ms: 1,
        credit_ms: 0,
        earliest_expiry_at_ms: null,
        negative_ms: 0,
      },
      customer_id: "customer_1",
      is_registered: true,
      plan: "free",
      purchases_enabled: true,
    };

    expect(decodeCustomer({ ...payload, revenuecat_customer_id: "" })).toBeNull();
    expect(decodeCustomer({ ...payload, revenuecat_customer_id: "x".repeat(256) })).toBeNull();
  });
});

describe("fetchMurmurAppConfig", () => {
  afterEach(() => {
    configRequest.mockReset();
  });

  it("fails loudly when the config route is unavailable", async () => {
    configRequest.mockResolvedValue(new Response(null, { status: 503 }));

    await expect(fetchMurmurAppConfig()).rejects.toThrow("Murmur config request failed (503).");
  });

  it("decodes a successful config response", async () => {
    configRequest.mockResolvedValue(Response.json({ low_balance_threshold_minutes: 10 }));

    await expect(fetchMurmurAppConfig()).resolves.toEqual({
      lowBalanceThresholdMinutes: 10,
      paywallOfferingId: null,
    });
  });
});
