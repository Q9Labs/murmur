import { defaultLowBalanceThresholdMinutes } from "./allowance";

export type MurmurAppConfig = {
  lowBalanceThresholdMinutes: number;
  paywallOfferingId: string | null;
};

export const defaultAppConfig: MurmurAppConfig = {
  lowBalanceThresholdMinutes: defaultLowBalanceThresholdMinutes,
  paywallOfferingId: null,
};

export function decodeAppConfig(payload: unknown): MurmurAppConfig | null {
  if (typeof payload !== "object" || payload === null) {
    return null;
  }
  const offeringId = Reflect.get(payload, "paywall_offering_id");
  const threshold = Reflect.get(payload, "low_balance_threshold_minutes");
  return {
    lowBalanceThresholdMinutes: isThresholdMinutes(threshold)
      ? threshold
      : defaultAppConfig.lowBalanceThresholdMinutes,
    paywallOfferingId: typeof offeringId === "string" && offeringId.trim()
      ? offeringId.trim()
      : null,
  };
}

function isThresholdMinutes(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}
