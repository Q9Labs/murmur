import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  claimHash: vi.fn().mockResolvedValue(null),
  ensureAllowance: vi.fn().mockResolvedValue({ result: { ok: true } }),
  getSession: vi.fn().mockResolvedValue({ user: { id: "customer-1" } }),
  ledger: vi.fn().mockImplementation(async (_namespace, _customerId, command) => ({
    response: new Response(),
    result: command.action === "open_usage_session"
      ? { balance: { availableMs: 0 }, ok: true }
      : { ok: true },
  })),
  queueOffer: vi.fn(),
}));

vi.mock("../auth/auth", () => ({ getMurmurSession: dependencies.getSession }));
vi.mock("../billing/allowanceService", () => ({ ensureCurrentAllowance: dependencies.ensureAllowance }));
vi.mock("../billing/customerLedgerDurableObject", () => ({ callCustomerLedger: dependencies.ledger }));
vi.mock("../billing/freeAllowanceClaims", () => ({ freeAllowanceClaimHashFromRequest: dependencies.claimHash }));
vi.mock("../billing/personalOffer", () => ({ queuePersonalOfferStart: dependencies.queueOffer }));

import { defaultServerConfig } from "../serverConfig";
import { prepareBillingUsage } from "./session";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("session exhaustion offer", () => {
  it("returns 402 and schedules the offer without waiting for D1", async () => {
    const pendingWrite = new Promise<void>(() => {});
    dependencies.queueOffer.mockReturnValueOnce(pendingWrite);
    const result = await prepareBillingUsage(
      new Request("https://worker.example/v2/session"),
      { BILLING_ENFORCEMENT_ENABLED: "true" },
      "session-1",
      1_000,
      { ...defaultServerConfig({}), personal_offer_enabled: true },
      "free",
    );
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.response.status).toBe(402);
    await expect(result.response.json()).resolves.toEqual({ error: "allowance_exhausted" });
    expect(dependencies.queueOffer).toHaveBeenCalledWith(expect.objectContaining({
      customerId: "customer-1",
      nowMs: 1_000,
    }));
  });

  it("does not offer a discount for exhausted Pro minutes", async () => {
    const result = await prepareBillingUsage(
      new Request("https://worker.example/v2/session"),
      { BILLING_ENFORCEMENT_ENABLED: "true" },
      "session-2",
      1_000,
      { ...defaultServerConfig({}), personal_offer_enabled: true },
      "pro",
    );
    expect(result.ok).toBe(false);
    expect(dependencies.queueOffer).not.toHaveBeenCalled();
  });
});
