import { afterEach, describe, expect, it, vi } from "vitest";

import { decodeRevenueCatCustomerState, verifyRevenueCatEvent } from "./revenueCatApi";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("RevenueCat customer verification", () => {
  it("decodes exact subscription and one-time purchase identity", () => {
    const state = decodeRevenueCatCustomerState({
      productIdentifiers: new Map([
        ["prod_monthly", "com.q9labsai.murmur.pro.monthly"],
        ["prod_pack", "murmur_credits_60"],
      ]),
      purchaseItems: [{
        environment: "sandbox",
        id: "purch_pack",
        product_id: "prod_pack",
        purchased_at: 1_800_000_000_000,
        status: "owned",
        store: "play_store",
        store_purchase_identifier: "GPA.1234",
      }],
      subscriptionItems: [{
        current_period_ends_at: 1_802_678_400_000,
        current_period_starts_at: 1_800_000_000_000,
        ends_at: 1_802_678_400_000,
        environment: "production",
        gives_access: true,
        id: "sub_monthly",
        product_id: "prod_monthly",
        starts_at: 1_799_000_000_000,
        status: "active",
        store: "app_store",
        store_subscription_identifier: 1000000123456,
      }],
    });

    expect(state.subscriptions).toEqual([expect.objectContaining({
      episodeId: "sub_monthly",
      productId: "com.q9labsai.murmur.pro.monthly",
      provider: "apple",
      storeSubscriptionId: "1000000123456",
    })]);
    expect(state.purchases).toEqual([expect.objectContaining({
      productId: "murmur_credits_60",
      provider: "google",
      storeTransactionId: "GPA.1234",
    })]);
  });

  it("drops malformed and unsupported store resources", () => {
    expect(decodeRevenueCatCustomerState({
      productIdentifiers: new Map(),
      purchaseItems: [{ id: "purchase" }],
      subscriptionItems: [{ id: "subscription", store: "stripe" }],
    })).toEqual({ purchases: [], subscriptions: [] });
  });

  it("verifies exact store and subscription identity through API v2", async () => {
    const seenAuthorizations: string[] = [];
    async function revenueCatFetch(
      input: RequestInfo | URL,
      init?: RequestInit,
    ): Promise<Response> {
      seenAuthorizations.push(new Headers(init?.headers).get("authorization") ?? "");
      const pathname = new URL(String(input)).pathname;
      if (pathname.endsWith("/subscriptions")) {
        return Response.json({
          items: [{
            current_period_ends_at: 1_802_678_400_000,
            current_period_starts_at: 1_800_000_000_000,
            ends_at: 1_802_678_400_000,
            environment: "production",
            gives_access: true,
            id: "sub_monthly",
            product_id: "prod_monthly",
            starts_at: 1_799_000_000_000,
            status: "active",
            store: "app_store",
            store_subscription_identifier: "original_1",
          }],
          next_page: null,
        });
      }
      if (pathname.endsWith("/purchases")) {
        return Response.json({ items: [], next_page: null });
      }
      if (pathname.endsWith("/products/prod_monthly")) {
        return Response.json({
          id: "prod_monthly",
          store_identifier: "com.q9labsai.murmur.pro.monthly",
        });
      }
      return Response.json({}, { status: 404 });
    }
    vi.stubGlobal("fetch", revenueCatFetch);

    const verified = await verifyRevenueCatEvent({
      env: {
        REVENUECAT_API_KEY: "secret-key",
        REVENUECAT_PROJECT_ID: "project-id",
      },
      event: {
        aliases: [],
        appUserId: "customer-1",
        cancelReason: null,
        environment: "production",
        eventId: "event-1",
        eventTimestampMs: 1_800_000_000_000,
        expirationAtMs: 1_802_678_400_000,
        originalAppUserId: "customer-1",
        originalPurchasedAtMs: 1_799_000_000_000,
        originalTransactionId: "original_1",
        productId: "com.q9labsai.murmur.pro.monthly",
        provider: "apple",
        purchasedAtMs: 1_800_000_000_000,
        transactionId: "transaction-1",
        type: "RENEWAL",
      },
    });

    expect(verified).toEqual(expect.objectContaining({ episodeId: "sub_monthly" }));
    expect(seenAuthorizations).toEqual([
      "Bearer secret-key",
      "Bearer secret-key",
      "Bearer secret-key",
    ]);
  });
});
