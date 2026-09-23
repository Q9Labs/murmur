import { Check } from "lucide-react-native";
import { useState } from "react";
import type { ReactNode } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

import type { MurmurBillingContext } from "../../lib/billing/context";
import {
  codeStep,
  type EmailSignInState,
  failureMessage,
  initialEmailSignIn,
  isCompleteCode,
  isPlausibleEmail,
  normalizeEmail,
  sanitizeCode,
} from "./emailSignInState";
import { type AuthStyles, useAuthStyles } from "./styles";

export type AuthDoneAction = {
  disabled?: boolean;
  label: string;
  onPress: () => void;
};

export type EmailSignInHandlers = {
  onChangeEmail: () => void;
  onCodeChange: (code: string) => void;
  onEmailChange: (email: string) => void;
  onResend: () => void;
  onSendCode: () => void;
  onVerify: () => void;
};

export function emailSignInTitle(state: EmailSignInState): string {
  if (state.step === "done") {
    return "You're signed in";
  }
  return state.step === "code" ? "Enter the code" : "Sign in";
}

export function useEmailSignIn(
  billing: MurmurBillingContext,
  initialState: EmailSignInState = initialEmailSignIn,
): { handlers: EmailSignInHandlers; state: EmailSignInState } {
  const [state, setState] = useState<EmailSignInState>(initialState);

  async function sendCode(email: string, resend: boolean): Promise<void> {
    setState(resend
      ? { ...codeStep(email), pending: "resend" }
      : { email, error: null, pending: true, step: "email" });
    try {
      await billing.sendSignInCode(email);
      setState(codeStep(email, resend ? "We sent a new code." : null));
    } catch (failure) {
      const error = failureMessage(failure, "Murmur could not send the code. Try again.");
      setState(resend
        ? { ...codeStep(email), error }
        : { email, error, pending: false, step: "email" });
    }
  }

  async function verify(email: string, code: string): Promise<void> {
    setState({ ...codeStep(email), code, pending: "verify" });
    try {
      await billing.verifySignInCode(email, code);
      setState({ email, step: "done" });
    } catch (failure) {
      setState({ ...codeStep(email), error: failureMessage(failure, "That code didn't work. Try again.") });
    }
  }

  const handlers: EmailSignInHandlers = {
    onChangeEmail: () => setState({ email: state.email, error: null, pending: false, step: "email" }),
    onCodeChange: (code) => {
      if (state.step === "code") {
        setState({ ...state, code: sanitizeCode(code), error: null });
      }
    },
    onEmailChange: (email) => setState({ email, error: null, pending: false, step: "email" }),
    onResend: () => void sendCode(state.email, true),
    onSendCode: () => {
      if (!isPlausibleEmail(state.email)) {
        setState({ email: state.email, error: "Enter a valid email address.", pending: false, step: "email" });
        return;
      }
      void sendCode(normalizeEmail(state.email), false);
    },
    onVerify: () => {
      if (state.step !== "code") {
        return;
      }
      if (!isCompleteCode(state.code)) {
        setState({ ...state, error: "Enter the 6-digit code from the email." });
        return;
      }
      void verify(state.email, state.code);
    },
  };

  return { handlers, state };
}

export function EmailSignInView(props: {
  doneAction: AuthDoneAction;
  handlers: EmailSignInHandlers;
  state: EmailSignInState;
}): ReactNode {
  const { styles } = useAuthStyles();
  const { state } = props;
  if (state.step === "done") {
    return <SignedIn doneAction={props.doneAction} email={state.email} styles={styles} />;
  }
  if (state.step === "code") {
    return <CodeEntry handlers={props.handlers} state={state} styles={styles} />;
  }
  return <EmailEntry handlers={props.handlers} state={state} styles={styles} />;
}

function EmailEntry(props: {
  handlers: EmailSignInHandlers;
  state: Extract<EmailSignInState, { step: "email" }>;
  styles: AuthStyles;
}): ReactNode {
  const { colors } = useAuthStyles();
  const { state, styles } = props;
  return (
    <View style={styles.flow}>
      <TextInput
        accessibilityLabel="Email address"
        autoCapitalize="none"
        autoComplete="email"
        autoCorrect={false}
        autoFocus
        editable={!state.pending}
        inputMode="email"
        onChangeText={props.handlers.onEmailChange}
        onSubmitEditing={props.handlers.onSendCode}
        placeholder="you@example.com"
        placeholderTextColor={colors.muted}
        returnKeyType="send"
        style={[styles.input, state.error !== null && styles.inputError]}
        textContentType="emailAddress"
        value={state.email}
      />
      {state.error ? (
        <Text accessibilityLiveRegion="assertive" style={styles.error}>{state.error}</Text>
      ) : null}
      <PrimaryButton
        label={state.pending ? "Sending…" : "Email me a code"}
        onPress={props.handlers.onSendCode}
        pending={state.pending}
        styles={styles}
      />
    </View>
  );
}

function CodeEntry(props: {
  handlers: EmailSignInHandlers;
  state: Extract<EmailSignInState, { step: "code" }>;
  styles: AuthStyles;
}): ReactNode {
  const { colors } = useAuthStyles();
  const { state, styles } = props;
  const pending = state.pending !== null;
  return (
    <View style={styles.flow}>
      <Text style={styles.body}>
        Sent to <Text style={styles.emphasis}>{state.email}</Text>
      </Text>
      <TextInput
        accessibilityLabel="Six-digit sign-in code"
        autoComplete="one-time-code"
        autoFocus
        editable={!pending}
        inputMode="numeric"
        maxLength={6}
        onChangeText={props.handlers.onCodeChange}
        onSubmitEditing={props.handlers.onVerify}
        placeholder="000000"
        placeholderTextColor={colors.muted}
        style={[styles.input, styles.codeInput, state.error !== null && styles.inputError]}
        textContentType="oneTimeCode"
        value={state.code}
      />
      {state.error ? (
        <Text accessibilityLiveRegion="assertive" style={styles.error}>{state.error}</Text>
      ) : null}
      {state.notice ? (
        <Text accessibilityLiveRegion="polite" style={styles.notice}>{state.notice}</Text>
      ) : null}
      <PrimaryButton
        label={codeButtonLabel(state.pending)}
        onPress={props.handlers.onVerify}
        pending={pending}
        styles={styles}
      />
      <View style={styles.linkRow}>
        <TextLink disabled={pending} label="Send a new code" onPress={props.handlers.onResend} styles={styles} />
        <TextLink disabled={pending} label="Change email" onPress={props.handlers.onChangeEmail} styles={styles} />
      </View>
    </View>
  );
}

function codeButtonLabel(pending: "resend" | "verify" | null): string {
  if (pending === "verify") {
    return "Signing in…";
  }
  return pending === "resend" ? "Sending…" : "Sign in";
}

function SignedIn(props: { doneAction: AuthDoneAction; email: string; styles: AuthStyles }): ReactNode {
  const { colors } = useAuthStyles();
  const { styles } = props;
  return (
    <View style={styles.flow}>
      <View accessibilityElementsHidden importantForAccessibility="no" style={styles.doneBadge}>
        <Check color={colors.teal} size={30} strokeWidth={2.5} />
      </View>
      <Text accessibilityLiveRegion="polite" style={[styles.body, styles.centered]}>
        Signed in as <Text style={styles.emphasis}>{props.email}</Text>
      </Text>
      <PrimaryButton
        label={props.doneAction.label}
        onPress={props.doneAction.onPress}
        pending={props.doneAction.disabled === true}
        styles={styles}
      />
    </View>
  );
}

function PrimaryButton(props: {
  label: string;
  onPress: () => void;
  pending: boolean;
  styles: AuthStyles;
}): ReactNode {
  const { styles } = props;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ busy: props.pending, disabled: props.pending }}
      disabled={props.pending}
      onPress={props.onPress}
      style={({ pressed }) => [
        styles.primaryButton,
        props.pending && styles.primaryButtonPending,
        pressed && styles.pressed,
      ]}
    >
      <Text style={styles.primaryButtonText}>{props.label}</Text>
    </Pressable>
  );
}

function TextLink(props: {
  disabled: boolean;
  label: string;
  onPress: () => void;
  styles: AuthStyles;
}): ReactNode {
  return (
    <Pressable
      accessibilityLabel={props.label}
      accessibilityRole="button"
      accessibilityState={{ disabled: props.disabled }}
      disabled={props.disabled}
      hitSlop={10}
      onPress={props.onPress}
      style={({ pressed }) => [(pressed || props.disabled) && props.styles.pressed]}
    >
      <Text style={props.styles.linkText}>{props.label}</Text>
    </Pressable>
  );
}
