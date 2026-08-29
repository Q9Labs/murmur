import { describe, expect, it } from "vitest";

import {
  decodeIgnoredRevenueCatEvent,
  decodeRevenueCatEvent,
  isIgnoredRevenueCatEventType,
  revenueCatCustomerIds,
} from "./revenueCatEvent";

describe("RevenueCat event decoding", () => {
  it("normalizes an App Store production purchase", () => {
    const event = decodeRevenueCatEvent({
      api_version: "1.0",
      event: {
        aliases: ["customer_old"],
        app_user_id: "customer_1",
        environment: "PRODUCTION",
        event_timestamp_ms: 1_800_000_000_000,
        expiration_at_ms: 1_802_678_400_000,
        id: "event_1",
        original_app_user_id: "customer_1",
        original_purchase_at_ms: 1_799_000_000_000,
        original_transaction_id: "original_1",
        product_id: "com.q9labsai.murmur.pro.monthly",
        purchased_at_ms: 1_800_000_000_000,
        store: "APP_STORE",
        transaction_id: "transaction_1",
        type: "INITIAL_PURCHASE",
      },
    });
    expect(event).toMatchObject({
      appUserId: "customer_1",
      environment: "production",
      originalPurchasedAtMs: 1_799_000_000_000,
      provider: "apple",
      type: "INITIAL_PURCHASE",
    });
    expect(event ? revenueCatCustomerIds(event) : []).toEqual([
      "customer_1",
      "customer_old",
    ]);
  });

  it("rejects unknown versions and incomplete identity", () => {
    expect(decodeRevenueCatEvent({ api_version: "2.0", event: {} })).toBeNull();
    expect(decodeRevenueCatEvent({
      api_version: "1.0",
      event: { environment: "SANDBOX", id: "event", type: "TEST" },
    })).toBeNull();
  });

  it("recognizes signed non-entitlement notifications without purchase fields", () => {
    expect(decodeIgnoredRevenueCatEvent({
      api_version: "1.0",
      event: {
        event_timestamp_ms: 1_700_000_000_000,
        id: "transfer-event",
        transferred_from: ["old-customer"],
        transferred_to: ["new-customer"],
        type: "TRANSFER",
      },
    })).toEqual({ eventId: "transfer-event", type: "TRANSFER" });
    expect(isIgnoredRevenueCatEventType("PRODUCT_CHANGE")).toBe(true);
    expect(isIgnoredRevenueCatEventType("SUBSCRIPTION_PAUSED")).toBe(false);
    expect(decodeIgnoredRevenueCatEvent({
      api_version: "1.0",
      event: { id: "renewal-event", type: "RENEWAL" },
    })).toBeNull();
  });
});
