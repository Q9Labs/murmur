import type { MobileBillingTelemetryEventName } from "@murmur/protocol/telemetry";

import type { MessageKey } from "../../i18n/catalogs/en";
import { LocalizedError } from "../../i18n/localizedError";
import type { MurmurPlan } from "./planCatalog";

export type PlanSurface = "plan_picker" | "hard_paywall";

export type BillingTelemetryReporter = (
  event: MobileBillingTelemetryEventName,
  options?: { errorCode?: string; packageLabel?: string; resultCategory?: string },
) => void;

export async function loadPlansWithTelemetry(
  serverOfferingId: string | null,
  report: BillingTelemetryReporter,
  surface: PlanSurface = "plan_picker",
): Promise<MurmurPlan[]> {
  report("mobile_paywall_opened", { packageLabel: surface });
  try {
    const { loadMurmurPlans } = await import("./revenueCat");
    return await loadMurmurPlans(serverOfferingId);
  } catch (failure) {
    report("mobile_paywall_failed", {
      errorCode: paywallFailureCode(failure),
      packageLabel: surface,
      resultCategory: "store_error",
    });
    throw failure;
  }
}

const localizedFailureCodes: Partial<Record<MessageKey, string>> = {
  "billing.notConfigured": "sdk_not_configured",
  "billing.productsMissing": "offering_missing",
  "billing.basePlanMissing": "play_base_plan_missing",
  "billing.storePriceMissing": "play_price_missing",
  "billing.offerPriceMissing": "play_offer_missing",
  "billing.personalOfferMissing": "play_offer_missing",
};

// Only fixed names and RevenueCat's numeric and readable error codes leave the device, never SDK message text.
function paywallFailureCode(failure: unknown): string {
  if (failure instanceof LocalizedError) return localizedFailureCodes[failure.messageKey] ?? "unclassified";
  return revenueCatFailureCode(failure) ?? "unclassified";
}

// Purchases.getOfferings is the only call in this path that rejects with a RevenueCat error.
function revenueCatFailureCode(failure: unknown): string | null {
  if (typeof failure !== "object" || failure === null) return null;
  const code: unknown = Reflect.get(failure, "code");
  if (typeof code !== "string" || !/^\d{1,3}$/.test(code)) return null;
  const info: unknown = Reflect.get(failure, "userInfo");
  const readable: unknown = typeof info === "object" && info !== null ? Reflect.get(info, "readableErrorCode") : null;
  const name = typeof readable === "string" && /^[A-Z_]{1,48}$/.test(readable) ? `:${readable.toLowerCase()}` : "";
  return `get_offerings:${code}${name}`;
}
