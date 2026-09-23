import { isLanguageCode, type LanguageCode } from "@murmur/protocol/languages";

import { defaultLowBalanceThresholdMinutes } from "./allowance";

export type MurmurAppConfig = {
  enabledLanguages: LanguageCode[] | null;
  lowBalanceThresholdMinutes: number;
  paywallOfferingId: string | null;
  personalOffer: { expiresAt: string; offeringId: string } | null;
};

export const defaultAppConfig: MurmurAppConfig = {
  enabledLanguages: null,
  lowBalanceThresholdMinutes: defaultLowBalanceThresholdMinutes,
  paywallOfferingId: null,
  personalOffer: null,
};

export function decodeAppConfig(payload: unknown): MurmurAppConfig | null {
  if (typeof payload !== "object" || payload === null) {
    return null;
  }
  const offeringId = Reflect.get(payload, "paywall_offering_id");
  const threshold = Reflect.get(payload, "low_balance_threshold_minutes");
  const personalOffer = decodePersonalOffer(Reflect.get(payload, "personal_offer"));
  if (personalOffer === undefined) {
    return null;
  }
  return {
    enabledLanguages: decodeEnabledLanguages(Reflect.get(payload, "enabled_languages")),
    lowBalanceThresholdMinutes: isThresholdMinutes(threshold)
      ? threshold
      : defaultAppConfig.lowBalanceThresholdMinutes,
    paywallOfferingId: typeof offeringId === "string" && offeringId.trim()
      ? offeringId.trim()
      : null,
    personalOffer,
  };
}

function decodePersonalOffer(value: unknown): MurmurAppConfig["personalOffer"] | undefined {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value !== "object") {
    return undefined;
  }
  const offeringId = Reflect.get(value, "offering_id");
  const expiresAt = Reflect.get(value, "expires_at");
  if (typeof offeringId !== "string" || !offeringId ||
    typeof expiresAt !== "string" || !Number.isFinite(Date.parse(expiresAt))) {
    return undefined;
  }
  return { expiresAt, offeringId };
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
