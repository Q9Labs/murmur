import { useRouter } from "expo-router";
import type { ReactNode } from "react";

import { useMurmurBilling } from "../../lib/billing/context";
import type { PlanTerm } from "../../lib/billing/planCatalog";
import { ScreenScaffold, StatusLine } from "../screenScaffold";
import { PlanList, usePlanList } from "./planList";
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

export function PlansScreen(props: { initialTerm?: PlanTerm; offer?: ReactNode }): ReactNode {
  const router = useRouter();
  const billing = useMurmurBilling();
  const { plans, refresh } = usePlanList(true, billing.loadPlans);

  return (
    <ScreenScaffold title="Plans">
      {props.offer ?? null}
      <PlanList
        initialTerm={props.initialTerm}
        mode={purchaseMode(billing, (plan) =>
          router.push({ params: { plan: plan.id }, pathname: "/sign-in" }))}
        onRetry={refresh}
        plans={plans}
      />
      <StatusLine error={billing.error} notice={billing.notice} />
    </ScreenScaffold>
  );
}
