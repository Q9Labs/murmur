import { useRouter } from "expo-router";
import type { ReactNode } from "react";

import { useMurmurBilling } from "../../lib/billing/context";
import { planPurchaseLabel } from "../../lib/billing/planCatalog";
import { usePlanList } from "../plans/planList";
import { ScreenScaffold } from "../screenScaffold";
import { type AuthDoneAction, EmailSignInView, emailSignInTitle, useEmailSignIn } from "./emailSignIn";
import type { EmailSignInState } from "./emailSignInState";

export function SignInScreen(props: { initialState?: EmailSignInState; planId?: string }): ReactNode {
  const router = useRouter();
  const billing = useMurmurBilling();
  const { handlers, state } = useEmailSignIn(billing, props.initialState);
  const { plans } = usePlanList(props.planId !== undefined, billing.loadPlans);
  const plan = plans.status === "ready"
    ? plans.plans.find((candidate) => candidate.id === props.planId)
    : undefined;
  const leave = (): void => (router.canGoBack() ? router.back() : router.replace("/"));
  const doneAction: AuthDoneAction = plan
    ? {
        label: planPurchaseLabel(plan),
        onPress: () => {
          void billing.purchasePlan(plan.id);
          leave();
        },
      }
    : { label: "Done", onPress: leave };

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
