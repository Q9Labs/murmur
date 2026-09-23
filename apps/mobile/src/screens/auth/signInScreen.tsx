import { useRouter } from "expo-router";
import { useState, type ReactNode } from "react";

import { useMurmurBilling } from "../../lib/billing/context";
import { type MurmurPlan, planPurchaseLabel } from "../../lib/billing/planCatalog";
import { type PlanListState, usePlanList } from "../plans/planList";
import { ScreenScaffold } from "../screenScaffold";
import { type AuthDoneAction, EmailSignInView, emailSignInTitle, useEmailSignIn } from "./emailSignIn";
import type { EmailSignInState } from "./emailSignInState";

export function findCheckoutPlan(plans: PlanListState, planId: string | undefined): MurmurPlan | null {
  if (planId === undefined || plans.status !== "ready") {
    return null;
  }
  return plans.plans.find((candidate) => candidate.id === planId) ?? null;
}

export function checkoutDoneAction(params: {
  leave: () => void;
  plan: MurmurPlan | null;
  planId: string | undefined;
  purchasePlan: (planId: string) => Promise<void>;
}): AuthDoneAction {
  const { planId } = params;
  if (planId === undefined) {
    return { label: "Done", onPress: params.leave };
  }
  return {
    label: params.plan ? planPurchaseLabel(params.plan) : "Continue to checkout",
    onPress: () => {
      void params.purchasePlan(planId);
      params.leave();
    },
  };
}

export function SignInScreen(props: { initialState?: EmailSignInState; planId?: string }): ReactNode {
  const router = useRouter();
  const billing = useMurmurBilling();
  const { handlers, state } = useEmailSignIn(billing, props.initialState);
  const { plans } = usePlanList(props.planId !== undefined, billing.loadPlans);
  const [heldPlan, setHeldPlan] = useState<MurmurPlan | null>(null);
  const foundPlan = findCheckoutPlan(plans, props.planId);
  if (foundPlan && !heldPlan) {
    setHeldPlan(foundPlan);
  }
  const doneAction = checkoutDoneAction({
    leave: () => (router.canGoBack() ? router.back() : router.replace("/")),
    plan: heldPlan ?? foundPlan,
    planId: props.planId,
    purchasePlan: billing.purchasePlan,
  });

  return (
    <ScreenScaffold title={emailSignInTitle(state)}>
      <EmailSignInView doneAction={doneAction} handlers={handlers} state={state} />
    </ScreenScaffold>
  );
}

export function planIdFromParam(value: string | string[] | undefined): string | undefined {
  const param = Array.isArray(value) ? value[0] : value;
  return param?.trim() ? param : undefined;
}
