import { describe, expect, it } from "vitest";

import type { RevenueCatPurchase, RevenueCatSubscription } from "./revenueCatApi";
import {
  revenueCatResourceFingerprint,
  revenueCatResourceKey,
} from "./revenueCatReconciliation";

describe("RevenueCat reconciliation resource state", () => {
  it("changes the purchase fingerprint across refund transitions", () => {
    const purchase: RevenueCatPurchase = {
      environment: "production",
      productId: "com.q9labsai.murmur.credits.60",
      provider: "apple",
      purchaseId: "purchase-1",
      purchasedAtMs: 1_800_000_000_000,
      status: "owned",
      storeTransactionId: "transaction-1",
    };

    expect(revenueCatResourceKey(purchase)).toBe("apple:production:purchase:purchase-1");
    expect(revenueCatResourceFingerprint({ ...purchase, status: "refunded" }))
      .not.toBe(revenueCatResourceFingerprint(purchase));
  });

  it("changes the subscription fingerprint at renewal", () => {
    const subscription: RevenueCatSubscription = {
      currentPeriodStartsAtMs: 1_800_000_000_000,
      environment: "sandbox",
      episodeId: "subscription-1",
      givesAccess: true,
      originalPurchasedAtMs: 1_799_000_000_000,
      paidThroughMs: 1_802_678_400_000,
      productId: "murmur_pro:monthly",
      provider: "google",
      status: "active",
      storeSubscriptionId: "store-subscription-1",
    };

    expect(revenueCatResourceKey(subscription))
      .toBe("google:sandbox:subscription:subscription-1");
    expect(revenueCatResourceFingerprint({
      ...subscription,
      currentPeriodStartsAtMs: 1_802_678_400_000,
      paidThroughMs: 1_805_270_400_000,
    })).not.toBe(revenueCatResourceFingerprint(subscription));
  });
});
