import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./customerLedgerDurableObject", () => ({
  callCustomerLedger: vi.fn(async () => ({
    response: Response.json({ ok: true }),
    result: { balance: {}, idempotent: false, ok: true },
  })),
}));

import { currentCustomerPlan, ensureCurrentAllowance } from "./allowanceService";
import { callCustomerLedger } from "./customerLedgerDurableObject";

const nowMs = 1_800_000_000_000;

function subscriptionDatabase(productId, provider) {
  const subscription = {
    anchor_at_ms: nowMs,
    episode_id: "episode-1",
    paid_through_ms: nowMs + 30 * 24 * 60 * 60_000,
    product_id: productId,
    provider,
  };
  return {
    prepare() {
      const statement = {
        all: async () => ({ results: [subscription] }),
        bind: () => statement,
        first: async () => ({ used_free_ms: 3 * 60_000 }),
        run: async () => ({ success: true }),
      };
      return statement;
    },
  };
}

beforeEach(() => vi.clearAllMocks());

describe("active subscription allowance", () => {
  it.each([
    ["com.q9labsai.murmur.promax.monthly", "apple", "pro_max", 397],
    ["murmur_promax:annual", "google", "pro_max", 397],
    ["com.q9labsai.murmur.pro.monthly.lite.offer", "apple", "pro", 87],
    ["murmur_pro_lite:monthly", "google", "pro", 87],
    ["murmur_pro:monthly", "google", "pro", 117],
  ])("grants the correct monthly allowance for %s", async (
    productId, provider, plan, firstGrantMinutes,
  ) => {
    const database = subscriptionDatabase(productId, provider);
    await expect(currentCustomerPlan(database, "customer-1", nowMs)).resolves.toBe(plan);
    await ensureCurrentAllowance({
      customerId: "customer-1",
      env: { BILLING_DB: database },
      nowMs,
      principalProvider: "anonymous",
    });
    expect(callCustomerLedger).toHaveBeenCalledWith(
      undefined,
      "customer-1",
      expect.objectContaining({
        action: "grant_value",
        amountMs: firstGrantMinutes * 60_000,
        grantKind: "pro",
      }),
    );
  });
});
