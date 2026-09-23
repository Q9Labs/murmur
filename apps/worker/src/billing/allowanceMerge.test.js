import { describe, expect, it, vi } from "vitest";

vi.mock("./customerLedgerDurableObject", () => ({ callCustomerLedger: vi.fn() }));

import { ensureCurrentAllowance } from "./allowanceService";
import { callCustomerLedger } from "./customerLedgerDurableObject";

describe("merged subscription allowance", () => {
  it("reuses the transferred Pro grant amount instead of recalculating it from destination Free usage", async () => {
    const nowMs = Date.UTC(2026, 8, 23);
    const database = {
      prepare(sql) {
        return {
          bind() { return this; },
          async first() {
            if (sql.includes("FROM subscriptions")) {
              return { anchor_at_ms: nowMs, episode_id: "guest-episode", paid_through_ms: nowMs + 2_592_000_000 };
            }
            if (sql.includes("SELECT original_ms FROM balance_grants")) {
              return { original_ms: 300_000 };
            }
            throw new Error(`Unexpected query: ${sql}`);
          },
          async run() { return { success: true }; },
        };
      },
    };
    const result = { ok: true };
    vi.mocked(callCustomerLedger).mockResolvedValue({ response: Response.json(result), result });

    await ensureCurrentAllowance({
      customerId: "registered-1",
      env: { BILLING_DB: database },
      nowMs,
      principalProvider: "email",
    });

    expect(callCustomerLedger).toHaveBeenCalledWith(
      undefined,
      "registered-1",
      expect.objectContaining({
        action: "grant_value",
        amountMs: 300_000,
        grantKey: "pro:guest-episode:0",
      }),
    );
  });
});
