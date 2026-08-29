import { afterEach, describe, expect, it, vi } from "vitest";

import { callCustomerLedger } from "./customerLedgerDurableObject";
import { createRealtimeUsageMeter } from "./realtimeUsageMeter";

vi.mock("./customerLedgerDurableObject", () => ({
  callCustomerLedger: vi.fn(),
}));

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("realtime usage meter", () => {
  it("closes the usage session even when final settlement fails", async () => {
    vi.spyOn(Date, "now").mockReturnValue(20_000);
    vi.mocked(callCustomerLedger)
      .mockResolvedValueOnce({
        response: Response.json({ code: "billing_unavailable", ok: false }, { status: 503 }),
        result: { code: "billing_unavailable", ok: false },
      })
      .mockResolvedValueOnce({
        response: Response.json({ idempotent: false, ok: true, usageSessionId: "usage-1" }),
        result: { idempotent: false, ok: true, usageSessionId: "usage-1" },
      });
    const meter = createRealtimeUsageMeter({
      availableMs: 60_000,
      customerId: "customer-1",
      namespace: undefined,
      usageSessionId: "usage-1",
    });

    expect(meter.checkAudio(48_000)).toBe("accepted");
    meter.recordAudio(48_000);

    await expect(meter.close("failed")).rejects.toThrow("usage settlement failed");
    expect(vi.mocked(callCustomerLedger)).toHaveBeenCalledTimes(2);
    expect(vi.mocked(callCustomerLedger).mock.calls[1]?.[2]).toEqual(expect.objectContaining({
      action: "close_usage_session",
      outcome: "failed",
      usageSessionId: "usage-1",
    }));
  });

  it("meters forwarded PCM bytes and enforces the unsettled window", async () => {
    vi.mocked(callCustomerLedger).mockResolvedValue({
      response: Response.json({
        allocations: [],
        balance: {
          allowanceMs: 55_000,
          availableMs: 55_000,
          creditMs: 0,
          earliestExpiryAtMs: 1_800_000_000_000,
          negativeMs: 0,
        },
        idempotent: false,
        ok: true,
      }),
      result: {
        allocations: [],
        balance: {
          allowanceMs: 55_000,
          availableMs: 55_000,
          creditMs: 0,
          earliestExpiryAtMs: 1_800_000_000_000,
          negativeMs: 0,
        },
        idempotent: false,
        ok: true,
      },
    });
    const meter = createRealtimeUsageMeter({
      availableMs: 60_000,
      customerId: "customer-1",
      namespace: undefined,
      usageSessionId: "usage-1",
    });

    expect(meter.checkAudio(240_000)).toBe("accepted");
    meter.recordAudio(240_000);
    expect(meter.checkAudio(48)).toBe("settlement_required");
    await expect(meter.settle()).resolves.toEqual({ availableMs: 55_000, exhausted: false });
    expect(vi.mocked(callCustomerLedger).mock.calls[0]?.[2]).toEqual(expect.objectContaining({
      action: "settle_usage",
      amountMs: 5_000,
    }));
    expect(meter.checkAudio(48)).toBe("accepted");
  });
});
