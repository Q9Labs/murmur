import { useRouter } from "expo-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { View } from "react-native";

import { type MurmurBillingContext, useMurmurBilling } from "../../lib/billing/context";
import { type MurmurPlan, planPurchaseLabel } from "../../lib/billing/planCatalog";
import { type PlanListState, usePlanList } from "../plans/planList";
import { ScreenScaffold, StatusLine } from "../screenScaffold";
import { type AuthDoneAction, EmailSignInView, emailSignInTitle, useEmailSignIn } from "./emailSignIn";
import type { EmailSignInState } from "./emailSignInState";
import { SocialSignInButtons } from "./socialButtons";
import { useAuthStyles } from "./styles";

export function findCheckoutPlan(plans: PlanListState, planId: string | undefined): MurmurPlan | null {
  if (planId === undefined || plans.status !== "ready") {
    return null;
  }
  return plans.plans.find((candidate) => candidate.id === planId) ?? null;
}

export type CheckoutAvailability = "busy" | "ready" | "unavailable";

export function checkoutAvailability(billing: MurmurBillingContext): CheckoutAvailability {
  const customer = billing.customer;
  const purchasable = customer !== null &&
    customer.isRegistered &&
    customer.purchasesEnabled &&
    customer.fulfillmentEnabled &&
    billing.purchasesAvailable;
  if (!purchasable) {
    return "unavailable";
  }
  return billing.busy ? "busy" : "ready";
}

export function checkoutDoneAction(params: {
  availability: CheckoutAvailability;
  leave: () => void;
  plan: MurmurPlan | null;
  planId: string | undefined;
  purchasePlan: (planId: string) => Promise<boolean>;
}): AuthDoneAction {
  const { planId } = params;
  if (planId === undefined) {
    return { label: "Done", onPress: params.leave };
  }
  if (params.availability === "unavailable") {
    return { label: "Back to plans", onPress: params.leave };
  }
  return {
    disabled: params.availability === "busy",
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
  const { plans } = usePlanList(
    props.planId !== undefined && billing.initialized,
    billing.loadPlansSilently,
  );
  const { styles } = useAuthStyles();
  const [heldPlan, setHeldPlan] = useState<MurmurPlan | null>(null);
  const [socialError, setSocialError] = useState<string | null>(null);
  const socialStarted = useRef(false);
  const foundPlan = findCheckoutPlan(plans, props.planId);
  if (foundPlan && !heldPlan) {
    setHeldPlan(foundPlan);
  }
  const doneAction = checkoutDoneAction({
    availability: checkoutAvailability(billing),
    leave: () => (router.canGoBack() ? router.back() : router.replace("/")),
    plan: heldPlan ?? foundPlan,
    planId: props.planId,
    purchasePlan: billing.purchasePlan,
  });

  const socialSignedIn = billing.customer?.isRegistered === true && state.step === "email";

  // A social sign-in has no code step, so the checkout or exit runs once the account is saved.
  useEffect(() => {
    if (socialSignedIn && socialStarted.current) {
      socialStarted.current = false;
      doneAction.onPress();
    }
  }, [doneAction, socialSignedIn]);

  return (
    <ScreenScaffold title={emailSignInTitle(state)}>
      {state.step === "email" ? (
        <View style={styles.flow}>
          <SocialSignInButtons
            disabled={billing.busy}
            onError={setSocialError}
            onStart={() => {
              socialStarted.current = true;
            }}
          />
          <StatusLine error={socialError} notice={null} />
        </View>
      ) : null}
      <EmailSignInView billingBusy={billing.busy} doneAction={doneAction} handlers={handlers} state={state} />
    </ScreenScaffold>
  );
}

export function planIdFromParam(value: string | string[] | undefined): string | undefined {
  const param = Array.isArray(value) ? value[0] : value;
  return param?.trim() ? param : undefined;
}
