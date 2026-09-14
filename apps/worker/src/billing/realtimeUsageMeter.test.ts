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
  it("meters and freezes audio when billing enforcement is disabled", async () => {
    const meter = createRealtimeUsageMeter({
      availableMs: Number.POSITIVE_INFINITY,
      customerId: null,
      enforceAllowance: false,
      namespace: undefined,
      usageSessionId: "usage-disabled-1",
    });

    expect(meter.checkAudio(480_000)).toBe("accepted");
    meter.recordAudio(480_000);
    await expect(meter.settle()).resolves.toEqual({
      availableMs: Number.POSITIVE_INFINITY,
      exhausted: false,
    });
    await meter.close("closed");
    expect(meter.checkAudio(48)).toBe("allowance_exhausted");
    expect(callCustomerLedger).not.toHaveBeenCalled();
  });

  it("settles audio accepted during an in-flight settlement before closing", async () => {
    let releaseFirstSettlement = (): void => {
      throw new Error("first settlement was not initialized");
    };
    const firstSettlement = new Promise<ReturnType<typeof successfulLedgerResult>>((resolve) => {
      releaseFirstSettlement = () => resolve(successfulLedgerResult(59_000));
    });
    vi.mocked(callCustomerLedger)
      .mockImplementationOnce(() => firstSettlement)
      .mockResolvedValueOnce(successfulLedgerResult(58_000))
      .mockResolvedValueOnce({
        response: Response.json({ idempotent: false, ok: true, usageSessionId: "usage-1" }),
        result: { idempotent: false, ok: true, usageSessionId: "usage-1" },
      });
    const meter = createBilledMeter();

    meter.recordAudio(48_000);
    const activeSettlement = meter.settle();
    meter.recordAudio(48_000);
    const close = meter.close("closed");
    expect(meter.checkAudio(48)).toBe("allowance_exhausted");
    releaseFirstSettlement();
    await activeSettlement;
    await close;

    expect(vi.mocked(callCustomerLedger).mock.calls.map((call) => call[2])).toEqual([
      expect.objectContaining({ action: "settle_usage", amountMs: 1_000 }),
      expect.objectContaining({ action: "settle_usage", amountMs: 1_000 }),
      expect.objectContaining({ action: "close_usage_session", outcome: "closed" }),
    ]);
  });

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
    const meter = createBilledMeter();

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
    vi.mocked(callCustomerLedger).mockResolvedValue(successfulLedgerResult(55_000));
    const meter = createBilledMeter();

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

function createBilledMeter() {
  return createRealtimeUsageMeter({
    availableMs: 60_000,
    customerId: "customer-1",
    namespace: undefined,
    usageSessionId: "usage-1",
  });
}

function successfulLedgerResult(availableMs: number) {
  const payload = {
    allocations: [],
    balance: {
      allowanceMs: availableMs,
      availableMs,
      creditMs: 0,
      earliestExpiryAtMs: 1_800_000_000_000,
      negativeMs: 0,
    },
    idempotent: false,
    ok: true as const,
  };
  return { response: Response.json(payload), result: payload };
}
