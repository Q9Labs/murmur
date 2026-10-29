import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  claim: vi.fn(async () => ({ claimable: false, remaining_ms: 180_000 })),
  gift: vi.fn(async () => ({ claimable: false, remaining_ms: 0 })),
  session: vi.fn(async (): Promise<{ user: { id: string } } | null> => ({ user: { id: "customer-1" } })),
}));

vi.mock("../billing/allowanceService", () => ({ currentCustomerPlan: async () => "free" }));

vi.mock("../auth/auth", () => ({ getMurmurSession: mocks.session }));
vi.mock("../billing/phoneAudioGift", () => ({
  claimPhoneAudioGift: mocks.claim,
  getPhoneAudioGift: mocks.gift,
}));

import { posthogFlagsBody } from "../posthogFlagsFixture";
import { claimPhoneAudioGiftRoute } from "./phoneAudioGift";

beforeEach(() => vi.clearAllMocks());

describe("POST /v3/gifts/phone-audio/claim", () => {
  it("requires a customer session", async () => {
    mocks.session.mockResolvedValueOnce(null);
    const response = await claimPhoneAudioGiftRoute(new Request("https://worker.test"), {});
    expect(response.status).toBe(401);
    expect(mocks.claim).not.toHaveBeenCalled();
  });

  it("claims for the authenticated customer while a free allowance exists", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(posthogFlagsBody({
      featureFlags: { free_allowance_minutes: true },
      featureFlagPayloads: { free_allowance_minutes: "5" },
    }))));
    const response = await claimPhoneAudioGiftRoute(new Request("https://worker.test"), {
      BILLING_DB: Object.create(null),
      POSTHOG_PROJECT_TOKEN: "test-token",
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      phone_audio: { claimable: false, remaining_ms: 180_000 },
    });
    expect(mocks.claim).toHaveBeenCalledWith(expect.anything(), "customer-1", expect.any(Number));
    vi.unstubAllGlobals();
  });

  it("never claims a gift when the hard paywall grants no free allowance", async () => {
    // No PostHog token → default config → free_allowance_minutes = 0.
    const response = await claimPhoneAudioGiftRoute(new Request("https://worker.test"), {
      BILLING_DB: Object.create(null),
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      phone_audio: { claimable: false, remaining_ms: 0 },
    });
    expect(mocks.claim).not.toHaveBeenCalled();
    expect(mocks.gift).toHaveBeenCalledWith(expect.anything(), "customer-1");
  });
});
