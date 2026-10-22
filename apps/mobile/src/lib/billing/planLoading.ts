import type { MobileBillingTelemetryEventName } from "@murmur/protocol/telemetry";

import type { MurmurPlan } from "./planCatalog";

export type PlanSurface = "plan_picker" | "hard_paywall";

export type BillingTelemetryReporter = (
  event: MobileBillingTelemetryEventName,
  options?: { packageLabel?: string; resultCategory?: string },
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
    report("mobile_paywall_failed", { resultCategory: "store_error" });
    throw failure;
  }
}
