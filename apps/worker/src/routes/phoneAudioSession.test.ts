import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  gift: vi.fn(async () => ({ claimable: false, remaining_ms: 0 })),
  plan: vi.fn(async () => "free" as const),
  session: vi.fn(async () => ({ user: { id: "customer-1" } })),
}));

vi.mock("../auth/auth", () => ({ getMurmurSession: mocks.session }));
vi.mock("../billing/allowanceService", () => ({ currentCustomerPlan: mocks.plan }));
vi.mock("../billing/phoneAudioGift", () => ({ getPhoneAudioGift: mocks.gift }));

import { createSession } from "./session";

beforeEach(() => vi.clearAllMocks());

describe("Phone audio session gate", () => {
  it("refuses free Phone audio without remaining gift time", async () => {
    const response = await createSession(new Request("https://worker.test/v2/session", {
      body: JSON.stringify({
        app_install_id: "install_12345678",
        capture_source: "phone_audio",
        source_language: "en",
        target_language: "ar",
      }),
      method: "POST",
    }), {
      BILLING_DB: Object.create(null),
      OPENAI_API_KEY: "test-key",
    });
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "feature_requires_pro" });
    expect(mocks.gift).toHaveBeenCalledWith(expect.anything(), "customer-1");
  });
});
