import { afterEach, describe, expect, it, vi } from "vitest";

const configRequest = vi.hoisted(() => vi.fn<() => Promise<Response>>());
const giftRequest = vi.hoisted(() => vi.fn<() => Promise<Response>>());

vi.mock("../providers/murmurBillingApi", () => ({ requestMurmurAppConfig: configRequest, requestPhoneAudioGiftClaim: giftRequest }));

import { claimPhoneAudioGift, fetchMurmurAppConfig } from "./customerApi";
import { decodeCustomer } from "./customerResponse";

describe("decodeCustomer", () => {
  it("decodes a durable customer balance", () => {
    expect(decodeCustomer({
      balance: {
        allowance_ms: 1_800_000,
        available_ms: 1_800_000,
        credit_ms: 0,
        earliest_expiry_at_ms: 1_800_000_000_000,
        negative_ms: 0,
      },
      customer_id: "customer_1",
      is_registered: false,
      plan: "free",
      purchases_enabled: false,
    })).toEqual({
      allowanceMs: 1_800_000,
      availableMs: 1_800_000,
      creditMs: 0,
      customerId: "customer_1",
      creditPacks: [],
      earliestExpiryAtMs: 1_800_000_000_000,
      entitlements: { pro: false, proMax: false },
      features: { history: false, maxSessionSeconds: 300, phoneAudio: false },
      fulfillmentEnabled: true,
      isRegistered: false,
      negativeMs: 0,
      plan: "free",
      purchasesEnabled: false,
      revenueCatCustomerId: "customer_1",
    });
  });

  it("decodes Pro Max features and individual pack expiries", () => {
    expect(decodeCustomer({
      balance: {
        allowance_ms: 400 * 60_000,
        available_ms: 430 * 60_000,
        credit_ms: 30 * 60_000,
        earliest_expiry_at_ms: 1_800_000_000_000,
        negative_ms: 0,
      },
      credit_packs: [{
        grant_id: `grant:${"transaction-".repeat(30)}`,
        remaining_ms: 30 * 60_000,
        expires_at_ms: 1_801_000_000_000,
      }],
      customer_id: "customer_1",
      entitlements: { pro: true, pro_max: true },
      features: { history: true, max_session_seconds: 3_600, phone_audio: true },
      is_registered: false,
      plan: "pro_max",
      purchases_enabled: true,
    })).toMatchObject({
      creditPacks: [{
        grantId: `grant:${"transaction-".repeat(30)}`,
        remainingMs: 30 * 60_000,
        expiresAtMs: 1_801_000_000_000,
      }],
      entitlements: { pro: true, proMax: true },
      features: { history: true, maxSessionSeconds: 3_600, phoneAudio: true },
      plan: "pro_max",
    });
  });

  it("rejects malformed or negative allowance values", () => {
    expect(decodeCustomer(null)).toBeNull();
    expect(decodeCustomer({
      balance: {
        allowance_ms: -1,
        available_ms: -1,
        credit_ms: 0,
        earliest_expiry_at_ms: null,
        negative_ms: 1,
      },
      customer_id: "customer_1",
      is_registered: false,
      plan: "free",
      purchases_enabled: false,
    })).toBeNull();
  });

  it("rejects empty or oversized store identities", () => {
    const payload = {
      balance: {
        allowance_ms: 1,
        available_ms: 1,
        credit_ms: 0,
        earliest_expiry_at_ms: null,
        negative_ms: 0,
      },
      customer_id: "customer_1",
      is_registered: true,
      plan: "free",
      purchases_enabled: true,
    };

    expect(decodeCustomer({ ...payload, revenuecat_customer_id: "" })).toBeNull();
    expect(decodeCustomer({ ...payload, revenuecat_customer_id: "x".repeat(256) })).toBeNull();
  });

  it("decodes Pro features and a claimed Phone audio gift", () => {
    const customer = decodeCustomer({
      balance: { allowance_ms: 1, available_ms: 1, credit_ms: 0, earliest_expiry_at_ms: null, negative_ms: 0 },
      customer_id: "customer_1",
      entitlements: { pro: true, pro_max: false },
      features: { phone_audio: true, history: true, max_session_seconds: 3600 },
      gifts: { phone_audio: { claimable: false, remaining_ms: 120_000 } },
      is_registered: false,
      plan: "pro",
      purchases_enabled: true,
    });
    expect(customer?.features).toEqual({ phoneAudio: true, history: true, maxSessionSeconds: 3600 });
    expect(customer?.gifts?.phoneAudio).toEqual({ claimable: false, remainingMs: 120_000 });
    expect(customer?.entitlements).toEqual({ pro: true, proMax: false });
  });
});

describe("claimPhoneAudioGift", () => {
  it("reports worker rejection and succeeds after a valid claim", async () => {
    giftRequest.mockResolvedValueOnce(Response.json({ error: "gift_unavailable" }, { status: 409 }));
    await expect(claimPhoneAudioGift()).rejects.toThrow("gift_unavailable");
    giftRequest.mockResolvedValueOnce(Response.json({ phone_audio: { claimable: false, remaining_ms: 180_000 } }));
    await expect(claimPhoneAudioGift()).resolves.toBeUndefined();
  });
});

describe("fetchMurmurAppConfig", () => {
  afterEach(() => {
    configRequest.mockReset();
  });

  it("fails loudly when the config route is unavailable", async () => {
    configRequest.mockResolvedValue(new Response(null, { status: 503 }));

    await expect(fetchMurmurAppConfig()).rejects.toThrow("Murmur config request failed (503).");
  });

  it("decodes a successful config response", async () => {
    configRequest.mockResolvedValue(Response.json({ low_balance_threshold_minutes: 10 }));

    await expect(fetchMurmurAppConfig()).resolves.toEqual({
      enabledLanguages: null,
      lowBalanceThresholdMinutes: 10,
      paywallOfferingId: null,
      personalOffer: null,
    });
  });
});
