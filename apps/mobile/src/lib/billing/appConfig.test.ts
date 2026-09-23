import { describe, expect, it } from "vitest";

import { decodeAppConfig, defaultAppConfig } from "./appConfig";

describe("app-facing server config", () => {
  it("reads the paywall offering and low-balance threshold", () => {
    expect(decodeAppConfig({
      enabled_languages: null,
      low_balance_threshold_minutes: 20,
      paywall_offering_id: "base_pro",
    })).toEqual({ lowBalanceThresholdMinutes: 20, paywallOfferingId: "base_pro" });
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
