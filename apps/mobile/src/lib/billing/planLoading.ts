import type { MobileBillingTelemetryEventName } from "@murmur/protocol/telemetry";

import { LocalizedError } from "../../i18n/localizedError";
import type { MurmurPlan } from "./planCatalog";

export type BillingTelemetryReporter = (
  event: MobileBillingTelemetryEventName,
  options?: { errorCode?: string; packageLabel?: string; resultCategory?: string },
) => void;

export async function loadPlansWithTelemetry(
  serverOfferingId: string | null,
  report: BillingTelemetryReporter,
): Promise<MurmurPlan[]> {
  report("mobile_paywall_opened", { packageLabel: "plan_picker" });
  try {
    const { loadMurmurPlans } = await import("./revenueCat");
    return await loadMurmurPlans(serverOfferingId);
  } catch (failure) {
    report("mobile_paywall_failed", {
      errorCode: paywallFailureCode(failure),
      resultCategory: "store_error",
    });
    throw failure;
  }
}

// Only fixed names and RevenueCat's numeric and readable error codes leave the device, never SDK message text.
export function paywallFailureCode(failure: unknown): string {
  if (failure instanceof LocalizedError) {
    switch (failure.messageKey) {
      case "billing.notConfigured": return "sdk_not_configured";
      case "billing.productsMissing": return "offering_missing";
      case "billing.basePlanMissing": return "play_base_plan_missing";
      case "billing.storePriceMissing": return "play_price_missing";
      case "billing.offerPriceMissing":
      case "billing.personalOfferMissing": return "play_offer_missing";
      default: return "unclassified";
    }
  }
  // Purchases.getOfferings is the only call in this path that rejects with a RevenueCat error.
  const code: unknown = typeof failure === "object" && failure !== null ? Reflect.get(failure, "code") : null;
  const info: unknown = typeof failure === "object" && failure !== null ? Reflect.get(failure, "userInfo") : null;
  const readable: unknown = typeof info === "object" && info !== null ? Reflect.get(info, "readableErrorCode") : null;
  if (typeof code !== "string" || !/^\d{1,3}$/.test(code)) return "unclassified";
  const name = typeof readable === "string" && /^[A-Z_]{1,48}$/.test(readable) ? `:${readable.toLowerCase()}` : "";
  return `get_offerings:${code}${name}`;
}
