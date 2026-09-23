import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";

import {
  freeAllowanceMinutes,
  isPaidCustomer,
  remainingMinutes,
} from "../lib/billing/allowance";
import { type MurmurBillingContext, useMurmurBilling } from "../lib/billing/context";
import type { MurmurPlan } from "../lib/billing/revenueCat";
import { EmailSignInForm } from "./accountBillingModal";
import { outOfMinutesIllustration } from "./illustrations";
import { ModalSheet } from "./modalSheet";
import {
  darkMurmurTheme,
  lightMurmurTheme,
  type MurmurTheme,
  useMurmurTheme,
} from "./theme";

export type OutOfMinutesReason = "exhausted" | "low_balance";

export type PlanListState =
  | { status: "loading" }
  | { plans: MurmurPlan[]; status: "ready" }
  | { message: string; status: "failed" };

export function OutOfMinutesSheetController(props: {
  onClose: () => void;
  open: boolean;
  reason: OutOfMinutesReason;
}): ReactNode {
  const billing = useMurmurBilling();
  const [plans, setPlans] = useState<PlanListState>({ status: "loading" });
  const { onClose, open } = props;
  const { loadPlans } = billing;
  const availableMs = billing.customer?.availableMs ?? 0;
  const latestAvailableMs = useRef(availableMs);
  const availableWhenOpened = useRef(availableMs);
  latestAvailableMs.current = availableMs;

  const refreshPlans = useCallback(() => {
    setPlans({ status: "loading" });
    loadPlans()
      .then((nextPlans) => setPlans({ plans: nextPlans, status: "ready" }))
      .catch((failure: unknown) => {
        setPlans({
          message: failure instanceof Error
            ? failure.message
            : "Plans are not available from the store right now.",
          status: "failed",
        });
      });
  }, [loadPlans]);

  useEffect(() => {
    if (open) {
      availableWhenOpened.current = latestAvailableMs.current;
      refreshPlans();
    }
  }, [open, refreshPlans]);

  useEffect(() => {
    if (open && availableMs > availableWhenOpened.current) {
      onClose();
    }
  }, [availableMs, onClose, open]);

  return (
    <OutOfMinutesSheet
      billing={billing}
      onClose={props.onClose}
      onRetryPlans={refreshPlans}
      open={props.open}
      plans={plans}
      reason={props.reason}
    />
  );
}

export function OutOfMinutesSheet(props: {
  billing: MurmurBillingContext;
  onClose: () => void;
  onRetryPlans: () => void;
  open: boolean;
  plans: PlanListState;
  reason: OutOfMinutesReason;
}): ReactNode {
  const styles = useOutOfMinutesStyles();
  const [signUpOpen, setSignUpOpen] = useState(false);
  const registered = props.billing.customer?.isRegistered === true;
  const title = props.reason === "low_balance" ? "Running low" : "Out of minutes";

  return (
    <ModalSheet onClose={props.onClose} open={props.open} scroll title={title}>
      <Image
        accessibilityIgnoresInvertColors
        accessible={false}
        resizeMode="contain"
        source={outOfMinutesIllustration}
        style={styles.illustration}
      />
      <Text style={styles.body}>{sheetMessage(props.billing, props.reason)}</Text>

      <View style={styles.section}>
        <Text accessibilityRole="header" style={styles.heading}>Plans</Text>
        <PlanList
          billing={props.billing}
          onNeedSignUp={() => setSignUpOpen(true)}
          onRetry={props.onRetryPlans}
          plans={props.plans}
          styles={styles}
        />
      </View>

      {registered ? null : (
        <SignUpToBuy
          billing={props.billing}
          onOpen={() => setSignUpOpen(true)}
          open={signUpOpen}
          styles={styles}
        />
      )}

      {props.billing.notice ? <Text style={styles.notice}>{props.billing.notice}</Text> : null}
      {props.billing.error ? (
        <Text accessibilityLiveRegion="assertive" style={styles.error}>{props.billing.error}</Text>
      ) : null}
    </ModalSheet>
  );
}

function sheetMessage(billing: MurmurBillingContext, reason: OutOfMinutesReason): string {
  const customer = billing.customer;
  if (reason === "low_balance" && customer) {
    const minutes = remainingMinutes(customer);
    return `${minutes} ${minutes === 1 ? "minute" : "minutes"} left. Top up now so your next conversation doesn't cut off.`;
  }
  if (customer && isPaidCustomer(customer)) {
    return "You've used all your translation time. Choose Pro or a top-up to keep talking.";
  }
  const nextStep = customer?.isRegistered
    ? "Choose Pro or a top-up to keep talking."
    : "Pick a plan to keep talking. You'll add your email first.";
  return `You've used your ${freeAllowanceMinutes} free minutes for this month. ${nextStep}`;
}

function SignUpToBuy(props: {
  billing: MurmurBillingContext;
  onOpen: () => void;
  open: boolean;
  styles: OutOfMinutesStyles;
}): ReactNode {
  const { styles } = props;
  if (!props.open) {
    return (
      <Pressable
        accessibilityHint="Add your email, then pick a plan"
        accessibilityRole="button"
        onPress={props.onOpen}
        style={({ pressed }) => [styles.signUpButton, pressed && styles.pressed]}
      >
        <Text style={styles.signUpButtonText}>Sign up to buy</Text>
      </Pressable>
    );
  }
  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={styles.heading}>Sign up to buy</Text>
      <Text style={styles.caption}>
        Add your email so your minutes and purchases follow you to any device.
      </Text>
      <EmailSignInForm billing={props.billing} />
    </View>
  );
}

function PlanList(props: {
  billing: MurmurBillingContext;
  onNeedSignUp: () => void;
  onRetry: () => void;
  plans: PlanListState;
  styles: OutOfMinutesStyles;
}): ReactNode {
  const { styles } = props;
  if (props.plans.status === "loading") {
    return <Text accessibilityLiveRegion="polite" style={styles.caption}>Loading plans…</Text>;
  }
  if (props.plans.status === "failed") {
    return (
      <View style={styles.planGroup}>
        <Text style={styles.error}>{props.plans.message}</Text>
        <Pressable
          accessibilityLabel="Try loading plans again"
          accessibilityRole="button"
          onPress={props.onRetry}
          style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}
        >
          <Text style={styles.retryText}>Try again</Text>
        </Pressable>
      </View>
    );
  }
  if (props.plans.plans.length === 0) {
    return <Text style={styles.caption}>No plans are available from the store right now.</Text>;
  }
  const customer = props.billing.customer;
  const registered = customer?.isRegistered === true;
  const storeReady = Boolean(
    customer?.purchasesEnabled && props.billing.purchasesAvailable && !props.billing.busy,
  );
  return (
    <View style={styles.planGroup}>
      {props.plans.plans.map((plan) => (
        <PlanRow
          disabled={registered && !storeReady}
          key={plan.id}
          needsSignUp={!registered}
          onPress={registered
            ? () => void props.billing.purchasePlan(plan.id)
            : props.onNeedSignUp}
          plan={plan}
          styles={styles}
        />
      ))}
    </View>
  );
}

function PlanRow(props: {
  disabled: boolean;
  needsSignUp: boolean;
  onPress: () => void;
  plan: MurmurPlan;
  styles: OutOfMinutesStyles;
}): ReactNode {
  const { plan, styles } = props;
  const isPro = plan.kind === "pro";
  return (
    <Pressable
      accessibilityHint={props.needsSignUp ? "Sign up first to buy this plan" : undefined}
      accessibilityLabel={`${plan.title}, ${plan.price}`}
      accessibilityRole="button"
      accessibilityState={{ disabled: props.disabled }}
      disabled={props.disabled}
      onPress={props.onPress}
      style={({ pressed }) => [
        styles.planRow,
        isPro && styles.planRowPro,
        props.disabled && styles.planRowUnavailable,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.planCopy}>
        <Text style={styles.planTitle}>{plan.title}</Text>
        <Text style={styles.planKind}>{isPro ? "Pro subscription" : "One-time top-up"}</Text>
      </View>
      <Text style={styles.planPrice}>{plan.price}</Text>
    </Pressable>
  );
}

function createOutOfMinutesStyles(theme: MurmurTheme) {
  return StyleSheet.create({
    body: {
      color: theme.muted,
      fontSize: 16,
      lineHeight: 24,
      textAlign: "center",
    },
    caption: {
      color: theme.muted,
      fontSize: 14,
      fontWeight: "600",
      lineHeight: 20,
    },
    error: {
      color: theme.dark ? theme.coral : "#B33A3A",
      fontSize: 13,
      fontWeight: "700",
      marginTop: 14,
    },
    heading: {
      color: theme.primary,
      fontSize: 18,
      fontWeight: "800",
    },
    illustration: {
      alignSelf: "center",
      height: 96,
      marginBottom: 8,
      width: 137,
    },
    notice: {
      color: theme.muted,
      fontSize: 13,
      fontWeight: "700",
      marginTop: 14,
    },
    planCopy: {
      flex: 1,
      gap: 3,
    },
    planGroup: {
      gap: 8,
    },
    planKind: {
      color: theme.muted,
      fontSize: 13,
      fontWeight: "600",
    },
    planPrice: {
      color: theme.primary,
      fontSize: 16,
      fontWeight: "800",
    },
    planRow: {
      alignItems: "center",
      borderColor: theme.hairline,
      borderRadius: 18,
      borderWidth: 1,
      flexDirection: "row",
      gap: 12,
      minHeight: 58,
      paddingHorizontal: 16,
      paddingVertical: 10,
    },
    planRowPro: {
      backgroundColor: theme.selected,
      borderColor: theme.selectedBorder,
    },
    planRowUnavailable: {
      borderStyle: "dashed",
    },
    planTitle: {
      color: theme.primary,
      fontSize: 17,
      fontWeight: "800",
    },
    pressed: {
      opacity: 0.55,
    },
    retryButton: {
      alignItems: "center",
      borderColor: theme.hairline,
      borderRadius: 16,
      borderWidth: 1,
      justifyContent: "center",
      minHeight: 48,
    },
    retryText: {
      color: theme.primary,
      fontSize: 16,
      fontWeight: "800",
    },
    section: {
      gap: 10,
      marginTop: 18,
    },
    signUpButton: {
      alignItems: "center",
      backgroundColor: theme.action,
      borderRadius: 999,
      justifyContent: "center",
      marginTop: 16,
      minHeight: 56,
      paddingHorizontal: 24,
    },
    signUpButtonText: {
      color: theme.onAction,
      fontSize: 17,
      fontWeight: "800",
    },
  });
}

type OutOfMinutesStyles = ReturnType<typeof createOutOfMinutesStyles>;

const lightStyles = createOutOfMinutesStyles(lightMurmurTheme);
const darkStyles = createOutOfMinutesStyles(darkMurmurTheme);

function useOutOfMinutesStyles(): OutOfMinutesStyles {
  return useMurmurTheme().dark ? darkStyles : lightStyles;
}
