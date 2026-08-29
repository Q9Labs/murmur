import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./customerLedgerDurableObject", () => ({
  callCustomerLedger: vi.fn(),
}));

import {
  currentCustomerPlan,
  ensureCurrentAllowance,
} from "./allowanceService";
import { callCustomerLedger } from "./customerLedgerDurableObject";
import type { LedgerCommandResult } from "./contracts";
import { mergeGuestCustomer } from "./guestAccountMerge";
import {
  AllowanceExhaustedError,
  CustomerDeletedError,
  LedgerRepository,
} from "./ledgerRepository";
import { RevenueCatEventRepository } from "./revenueCatEventRepository";
import { processRevenueCatEvent } from "./revenueCatProcessor";
import { findOpenUsageSession } from "./usageSessionStore";

const balance = {
  allowanceMs: 1_800_000,
  availableMs: 1_800_000,
  creditMs: 0,
  earliestExpiryAtMs: 2_000,
  negativeMs: 0,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("billing services", () => {
  it("bootstraps the current Free allowance when no Pro subscription exists", async () => {
    const result: LedgerCommandResult = { balance, created: true, ok: true };
    vi.mocked(callCustomerLedger).mockResolvedValue({
      response: Response.json(result),
      result,
    });

    await expect(currentCustomerPlan(undefined, "customer-1", 1_000)).resolves.toBe("free");
    await ensureCurrentAllowance({
      customerId: "customer-1",
      env: {},
      nowMs: Date.UTC(2026, 7, 29),
      principalProvider: "anonymous",
    });

    expect(callCustomerLedger).toHaveBeenCalledWith(
      undefined,
      "customer-1",
      expect.objectContaining({
        action: "bootstrap_guest",
        customerId: "customer-1",
        principalProvider: "anonymous",
      }),
    );
  });

  it("fails closed when durable merge and usage storage are unavailable", async () => {
    await expect(mergeGuestCustomer({
      database: undefined,
      destinationCustomerId: "customer-2",
      nowMs: 1_000,
      sourceCustomerId: "customer-1",
    })).rejects.toThrow("billing database is unavailable");
    await expect(findOpenUsageSession(undefined, "usage-1")).resolves.toBeNull();
  });

  it("rejects RevenueCat processing when D1 is unavailable", async () => {
    await expect(processRevenueCatEvent({
      env: {},
      event: {
        aliases: [],
        appUserId: "customer-1",
        cancelReason: null,
        environment: "sandbox",
        eventId: "event-1",
        eventTimestampMs: 1_000,
        expirationAtMs: null,
        originalAppUserId: "customer-1",
        originalPurchasedAtMs: null,
        originalTransactionId: null,
        productId: null,
        provider: null,
        purchasedAtMs: null,
        transactionId: null,
        type: "TEST",
      },
      nowMs: 1_000,
      payloadHash: "hash-1",
    })).resolves.toEqual({ code: "billing_unavailable", status: "failed" });
  });

  it("keeps D1 repositories and domain errors available at the storage boundary", () => {
    expect(LedgerRepository.prototype.getBalance).toBeTypeOf("function");
    expect(RevenueCatEventRepository.prototype.recordPending).toBeTypeOf("function");
    expect(new AllowanceExhaustedError(500).availableMs).toBe(500);
    expect(new CustomerDeletedError()).toBeInstanceOf(Error);
  });
});
