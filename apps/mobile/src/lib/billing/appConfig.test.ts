import { describe, expect, it } from "vitest";

import { decodeAppConfig, defaultAppConfig } from "./appConfig";

describe("app-facing server config", () => {
  it("reads the paywall offering and low-balance threshold", () => {
    expect(decodeAppConfig({
      enabled_languages: null,
      low_balance_threshold_minutes: 20,
      paywall_offering_id: "base_pro",
    })).toEqual({
      enabledLanguages: null,
      lowBalanceThresholdMinutes: 20,
      paywallOfferingId: "base_pro",
      personalOffer: null,
    });
  });

  it("keeps the server's lite offer and expiry for the paywall", () => {
    expect(decodeAppConfig({
      paywall_offering_id: "lite_personal_offer",
      personal_offer: {
        expires_at: "2026-09-25T10:00:00.000Z",
        offering_id: "lite_personal_offer",
      },
    })).toMatchObject({
      paywallOfferingId: "lite_personal_offer",
      personalOffer: {
        expiresAt: "2026-09-25T10:00:00.000Z",
        offeringId: "lite_personal_offer",
      },
    });
    expect(decodeAppConfig({ personal_offer: { offering_id: "personal_offer" } })).toBeNull();
  });

  it("keeps only known languages from enabled_languages", () => {
    expect(decodeAppConfig({ enabled_languages: ["en", "ar", "klingon"] })?.enabledLanguages)
      .toEqual(["en", "ar"]);
    expect(decodeAppConfig({ enabled_languages: ["klingon"] })?.enabledLanguages).toBeNull();
    expect(decodeAppConfig({ enabled_languages: [] })?.enabledLanguages).toEqual([]);
    expect(decodeAppConfig({ enabled_languages: "en" })?.enabledLanguages).toBeNull();
    expect(decodeAppConfig({})?.enabledLanguages).toBeNull();
  });

  it("falls back to defaults for unset or malformed keys", () => {
    expect(decodeAppConfig({})).toEqual(defaultAppConfig);
    expect(decodeAppConfig({
      low_balance_threshold_minutes: "15",
      paywall_offering_id: " ",
    })).toEqual(defaultAppConfig);
    expect(decodeAppConfig(null)).toBeNull();
  });
});
