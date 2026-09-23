import { useRouter } from "expo-router";
import type { ReactNode } from "react";

import { useMurmurBilling } from "../../lib/billing/context";
import { introDiscountPercent, type PlanTerm } from "../../lib/billing/planCatalog";
import { ScreenScaffold, StatusLine } from "../screenScaffold";
import { OfferBanner } from "./offerBanner";
import { PlanListStatus, usePlanList } from "./planList";
import { PlanCheckout, PlanPicker, usePlanPicker } from "./planPicker";
import { purchaseMode } from "./purchaseMode";

export function planTermFromParam(value: string | string[] | undefined): PlanTerm | undefined {
  const param = Array.isArray(value) ? value[0] : value;
  switch (param) {
    case "monthly":
      return "monthly";
    case "yearly":
      return "yearly";
    case "packs":
      return "pack";
    default:
      return undefined;
  }
}

export function PlansScreen(props: { initialTerm?: PlanTerm }): ReactNode {
  const router = useRouter();
  const billing = useMurmurBilling();
  const { plans, refresh } = usePlanList(billing.initialized, billing.loadPlans);
  const readyPlans = plans.status === "ready" ? plans.plans : [];
  const picker = usePlanPicker(readyPlans, props.initialTerm);
  const mode = purchaseMode(billing, () => router.replace("/save-purchase"));

  return (
    <ScreenScaffold
      footer={picker.selected ? <PlanCheckout mode={mode} plan={picker.selected} /> : null}
      title="Plans"
    >
      <OfferBanner
        discountPercent={introDiscountPercent(readyPlans)}
        expiresAtMs={billing.config.personalOfferExpiresAtMs}
      />
      {picker.activeTab ? <PlanPicker picker={picker} /> : <PlanListStatus onRetry={refresh} plans={plans} />}
      <StatusLine error={billing.error} notice={billing.notice} />
    </ScreenScaffold>
  );
}
