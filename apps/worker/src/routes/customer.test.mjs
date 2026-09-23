import { describe, expect, it, vi } from "vitest";

vi.mock("../auth/auth", () => ({
  getMurmurSession: vi.fn(async () => ({ user: { id: "guest-1", isAnonymous: true } })),
}));
vi.mock("../billing/allowanceService", () => ({
  currentCustomerPlan: vi.fn(async () => "pro_max"),
  ensureCurrentAllowance: vi.fn(async () => ({
    response: Response.json({ ok: true }),
    result: { ok: true },
  })),
}));
vi.mock("../billing/customerLedgerDurableObject", () => ({
  callCustomerLedger: vi.fn(async () => ({
    response: Response.json({ ok: true }),
    result: {
      balance: {
        allowanceMs: 400 * 60_000,
        availableMs: 430 * 60_000,
        creditMs: 30 * 60_000,
        earliestExpiryAtMs: 1_810_000_000_000,
        negativeMs: 0,
      },
      ok: true,
    },
  })),
}));
vi.mock("../billing/freeAllowanceClaims", () => ({
  freeAllowanceClaimHashFromRequest: vi.fn(async () => null),
}));

import { currentCustomerPlan } from "../billing/allowanceService";
import { getCustomer } from "./customer";

const database = {
  prepare() {
    const statement = {
      all: async () => ({
        results: [{ expires_at_ms: 1_810_000_000_000, grant_id: "pack-1", remaining_ms: 30 * 60_000 }],
      }),
      bind: () => statement,
    };
    return statement;
  },
};

describe("GET /v3/customer billing fields", () => {
  it("exposes Pro Max entitlements and every active pack expiry for a guest", async () => {
    const response = await getCustomer(
      new Request("https://worker.example.test/v3/customer"),
      { BILLING_DB: database, BILLING_FULFILLMENT_ENABLED: "true" },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      credit_packs: [{ expires_at_ms: 1_810_000_000_000, grant_id: "pack-1" }],
      entitlements: { pro: true, pro_max: true },
      features: { history: true, max_session_seconds: 3_600, phone_audio: true },
      is_registered: false,
      plan: "pro_max",
    });
  });

  it("does not enable paid features for Free", async () => {
    vi.mocked(currentCustomerPlan).mockResolvedValueOnce("free");
    const response = await getCustomer(
      new Request("https://worker.example.test/v3/customer"),
      { BILLING_DB: database, BILLING_FULFILLMENT_ENABLED: "true" },
    );
    expect(await response.json()).toMatchObject({
      entitlements: { pro: false, pro_max: false },
      features: { history: false, max_session_seconds: 300, phone_audio: false },
      plan: "free",
    });
  });
});
