import { describe, expect, it } from "vitest";

import { localizeRevenueCatEvent, revenueCatCustomerId } from "./revenueCatIdentity";
import type { RevenueCatEvent } from "./revenueCatEvent";

const event: RevenueCatEvent = {
  aliases: ["sandbox:alias", "production-customer"],
  appUserId: "sandbox:customer",
  cancelReason: null,
  environment: "sandbox",
  eventId: "event",
  eventTimestampMs: 1,
  expirationAtMs: null,
  originalAppUserId: "sandbox:customer",
  originalPurchasedAtMs: null,
  originalTransactionId: null,
  productId: "product",
  provider: "apple",
  purchasedAtMs: 1,
  transactionId: "transaction",
  type: "INITIAL_PURCHASE",
};

describe("RevenueCat customer identity", () => {
  it("isolates sandbox identifiers and removes the prefix before ledger lookup", () => {
    const env = { REVENUECAT_CUSTOMER_NAMESPACE: "sandbox" };
    expect(revenueCatCustomerId(env, "customer")).toBe("sandbox:customer");
    expect(localizeRevenueCatEvent(env, event)).toMatchObject({
      aliases: ["alias"],
      appUserId: "customer",
      originalAppUserId: "customer",
    });
  });

  it("ignores events from another namespace", () => {
    expect(localizeRevenueCatEvent(
      { REVENUECAT_CUSTOMER_NAMESPACE: "sandbox" },
      { ...event, appUserId: "production-customer" },
    )).toBeNull();
  });

  it("preserves legacy identifiers without a namespace", () => {
    expect(revenueCatCustomerId({}, "customer")).toBe("customer");
    expect(localizeRevenueCatEvent({}, { ...event, appUserId: "customer" })?.appUserId)
      .toBe("customer");
  });
});
