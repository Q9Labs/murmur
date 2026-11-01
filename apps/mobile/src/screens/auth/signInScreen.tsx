import { useRouter } from "expo-router";
import { useEffect, useRef, useState, type MutableRefObject, type ReactNode } from "react";
import { Text, View } from "react-native";

import { type Translate, type UiText, useUiLocale } from "../../i18n/runtime";
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
  ui: UiText;
}): AuthDoneAction {
  const { t } = params.ui;
  const { planId } = params;
  if (planId === undefined) {
    return { label: t("auth.done"), onPress: params.leave };
  }
  if (params.availability === "unavailable") {
    return { label: t("auth.backToPlans"), onPress: params.leave };
  }
  // Purchases are async: leave only after a completed purchase so cancellation
  // and failures stay recoverable on this screen. `busy`/`inFlight` guard both
  // manual taps and programmatic presses (e.g. the social sign-in effect).
  let inFlight = false;
  return {
    disabled: params.availability === "busy",
    label: params.plan ? planPurchaseLabel(params.plan, params.ui) : t("auth.continueToCheckout"),
    onPress: () => {
      if (params.availability === "busy" || inFlight) {
        return;
      }
      inFlight = true;
      void params.purchasePlan(planId)
        .catch(() => false)
        .then((purchased) => {
          if (purchased) {
            params.leave();
          }
        })
        .finally(() => {
          inFlight = false;
        });
    },
  };
}

function leaveSignIn(router: Pick<ReturnType<typeof useRouter>, "back" | "canGoBack" | "replace">): void {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace("/");
  }
}

function signInHeadline(
  providersShown: boolean,
  state: EmailSignInState,
  t: Translate,
): { lead?: string; title: string } {
  if (providersShown && state.step === "email") {
    return { lead: t("auth.createAccountLead"), title: t("auth.createAccountTitle") };
  }
  return { title: emailSignInTitle(state, t) };
}

function useHeldCheckoutPlan(plans: PlanListState, planId: string | undefined): MurmurPlan | null {
  const [heldPlan, setHeldPlan] = useState<MurmurPlan | null>(null);
  const foundPlan = findCheckoutPlan(plans, planId);
  if (foundPlan && !heldPlan) {
    setHeldPlan(foundPlan);
  }
  return heldPlan ?? foundPlan;
}

function useSocialCheckoutAutoContinue(params: {
  doneAction: AuthDoneAction;
  socialSignedIn: boolean;
}): MutableRefObject<boolean> {
  const socialStarted = useRef(false);
  const { doneAction, socialSignedIn } = params;
  // A social sign-in has no code step, so the checkout or exit runs once the account is saved.
  useEffect(() => {
    if (socialSignedIn && socialStarted.current) {
      socialStarted.current = false;
      doneAction.onPress();
    }
  }, [doneAction, socialSignedIn]);
  return socialStarted;
}

function ProviderStep(props: {
  disabled: boolean;
  legal: string;
  onError: (message: string | null) => void;
  onStart?: () => void;
}): ReactNode {
  const { styles } = useAuthStyles();
  const [socialError, setSocialError] = useState<string | null>(null);
  return (
    <View style={styles.flow}>
      <SocialSignInButtons
        disabled={props.disabled}
        onError={(message) => {
          setSocialError(message);
          props.onError(message);
        }}
        onStart={props.onStart}
      />
      <StatusLine error={socialError} notice={null} />
      <Text style={styles.legal}>{props.legal}</Text>
    </View>
  );
}

export function SignInScreen(props: { initialState?: EmailSignInState; planId?: string }): ReactNode {
  const router = useRouter();
  const billing = useMurmurBilling();
  const ui = useUiLocale();
  const { handlers, state } = useEmailSignIn(billing, props.initialState);
  const { plans } = usePlanList(
    props.planId !== undefined && billing.initialized,
    billing.loadPlansSilently,
  );
  const checkoutPlan = useHeldCheckoutPlan(plans, props.planId);
  const doneAction = checkoutDoneAction({
    availability: checkoutAvailability(billing),
    leave: () => leaveSignIn(router),
    plan: checkoutPlan,
    planId: props.planId,
    purchasePlan: billing.purchasePlan,
    ui,
  });

  const providersShown = state.step === "email";
  const socialSignedIn = billing.customer?.isRegistered === true && state.step === "email";
  const socialStarted = useSocialCheckoutAutoContinue({ doneAction, socialSignedIn });
  const headline = signInHeadline(providersShown, state, ui.t);

  return (
    <ScreenScaffold lead={headline.lead} serif title={headline.title}>
      {providersShown ? (
        <ProviderStep
          disabled={billing.busy}
          legal={ui.t("auth.continueLegal")}
          onError={() => undefined}
          onStart={() => {
            socialStarted.current = true;
          }}
        />
      ) : null}
      <EmailSignInView billingBusy={billing.busy} doneAction={doneAction} handlers={handlers} state={state} />
    </ScreenScaffold>
  );
}

export function planIdFromParam(value: string | string[] | undefined): string | undefined {
  const param = Array.isArray(value) ? value[0] : value;
  return param?.trim() ? param : undefined;
}
