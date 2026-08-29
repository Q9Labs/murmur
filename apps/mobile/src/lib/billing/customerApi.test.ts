import { describe, expect, it } from "vitest";

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
      isRegistered: false,
      negativeMs: 0,
      plan: "free",
      purchasesEnabled: false,
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
});
