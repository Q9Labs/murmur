import { beforeEach, describe, expect, it, vi } from "vitest";

const sentry = vi.hoisted(() => ({ captureException: vi.fn() }));
vi.mock("@sentry/cloudflare", () => sentry);

import type { Env } from "../env";
import type { RevenueCatPurchase, RevenueCatSubscription } from "./revenueCatApi";
import {
  reconcileDailyRevenueCatBatch,
  revenueCatResourceFingerprint,
  revenueCatResourceKey,
} from "./revenueCatReconciliation";

beforeEach(() => {
  vi.clearAllMocks();
});

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

function stubBillingDatabase(customerIds: string[]): D1Database {
  const statement = (sql: string): D1PreparedStatement => {
    const prepared = {
      all: async () => ({ results: customerIds.map((customer_id) => ({ customer_id })) }),
      bind: () => prepared,
      first: async () => (sql.includes("reconciliation_cursors") ? null : null),
      raw: async () => [],
      run: async () => ({ meta: { changes: 1 } }),
    };
    return prepared as unknown as D1PreparedStatement;
  };
  return { prepare: statement } as unknown as D1Database;
}

describe("RevenueCat daily reconciliation batch", () => {
  it("captures every per-customer failure with the customer and error code", async () => {
    const env: Env = {
      BILLING_DB: stubBillingDatabase(["customer-1", "customer-2"]),
      BILLING_FULFILLMENT_ENABLED: "true",
    };

    await expect(reconcileDailyRevenueCatBatch(env, 1_800_000_000_000))
      .resolves.toEqual({ attempted: 2, failed: 2 });

    expect(sentry.captureException).toHaveBeenCalledTimes(2);
    expect(sentry.captureException).toHaveBeenNthCalledWith(1, expect.any(Error), {
      tags: {
        customer_id: "customer-1",
        error_code: expect.stringContaining("revenuecat"),
        operation: "revenuecat_reconciliation",
      },
    });
    expect(sentry.captureException).toHaveBeenNthCalledWith(2, expect.any(Error), {
      tags: {
        customer_id: "customer-2",
        error_code: expect.stringContaining("revenuecat"),
        operation: "revenuecat_reconciliation",
      },
    });
  });
});
