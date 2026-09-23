import { isLanguageCode, type LanguageCode } from "@murmur/protocol/languages";

import { defaultLowBalanceThresholdMinutes } from "./allowance";

export type MurmurAppConfig = {
  enabledLanguages: LanguageCode[] | null;
  lowBalanceThresholdMinutes: number;
  paywallOfferingId: string | null;
  // When the worker's personal offer ends; null when there is no active offer.
  personalOfferExpiresAtMs: number | null;
};

export const defaultAppConfig: MurmurAppConfig = {
  enabledLanguages: null,
  lowBalanceThresholdMinutes: defaultLowBalanceThresholdMinutes,
  paywallOfferingId: null,
  personalOfferExpiresAtMs: null,
};

export function decodeAppConfig(payload: unknown): MurmurAppConfig | null {
  if (typeof payload !== "object" || payload === null) {
    return null;
  }
  const offeringId = Reflect.get(payload, "paywall_offering_id");
  const threshold = Reflect.get(payload, "low_balance_threshold_minutes");
  return {
    enabledLanguages: decodeEnabledLanguages(Reflect.get(payload, "enabled_languages")),
    lowBalanceThresholdMinutes: isThresholdMinutes(threshold)
      ? threshold
      : defaultAppConfig.lowBalanceThresholdMinutes,
    paywallOfferingId: typeof offeringId === "string" && offeringId.trim()
      ? offeringId.trim()
      : null,
    personalOfferExpiresAtMs: decodePersonalOfferExpiry(Reflect.get(payload, "personal_offer")),
  };
}

function decodePersonalOfferExpiry(value: unknown): number | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const expiresAt = Reflect.get(value, "expires_at");
  const expiresAtMs = typeof expiresAt === "string" ? Date.parse(expiresAt) : Number.NaN;
  return Number.isFinite(expiresAtMs) ? expiresAtMs : null;
}

// An explicit [] disables every language. A non-array, or a non-empty list with no known
// language codes, is treated as invalid and falls back to all languages.
function decodeEnabledLanguages(value: unknown): LanguageCode[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const languages = value.filter(isLanguageCode);
  if (value.length > 0 && languages.length === 0) {
    return null;
  }
  return languages;
}

function isThresholdMinutes(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}
