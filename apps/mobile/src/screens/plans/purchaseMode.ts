import type { MurmurBillingContext } from "../../lib/billing/context";
import type { MurmurPlan } from "../../lib/billing/planCatalog";
import type { PlanPurchaseMode } from "./planPicker";

export function purchaseMode(
  billing: MurmurBillingContext,
  onSignUp: (plan: MurmurPlan) => void,
): PlanPurchaseMode {
  const customer = billing.customer;
  if (!customer?.isRegistered) {
    return { kind: "sign_up", onSignUp };
  }
  return {
    kind: "buy",
    onBuy: (plan) => void billing.purchasePlan(plan.id),
    storeReady: customer.purchasesEnabled && billing.purchasesAvailable && !billing.busy,
  };
}
