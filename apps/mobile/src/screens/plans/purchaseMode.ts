import type { MurmurBillingContext } from "../../lib/billing/context";
import type { PlanPurchaseMode } from "./planPicker";

// Guests can buy without an email; a guest who just bought is asked to save the purchase.
export function purchaseMode(billing: MurmurBillingContext, onGuestPurchased: () => void): PlanPurchaseMode {
  const customer = billing.customer;
  return {
    onBuy: (plan) => {
      void billing.purchasePlan(plan.id).then((purchased) => {
        if (purchased && customer?.isRegistered !== true) {
          onGuestPurchased();
        }
      });
    },
    storeReady: customer?.purchasesEnabled === true && billing.purchasesAvailable && !billing.busy,
  };
}
