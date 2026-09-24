import { Check } from "lucide-react-native";
import { useState } from "react";
import type { ReactNode } from "react";
import { Pressable, type StyleProp, Text, TextInput, type TextStyle, View } from "react-native";
import { PostHogMaskView } from "posthog-react-native";

import type { MessageKey } from "../../i18n/catalogs/en";
import { failureCopy, LocalizedError } from "../../i18n/localizedError";
import { type Translate, useUiLocale } from "../../i18n/runtime";
import type { MurmurBillingContext } from "../../lib/billing/context";
import {
  codeStep,
  type EmailSignInState,
  initialEmailSignIn,
  isCompleteCode,
  isPlausibleEmail,
  normalizeEmail,
  sanitizeCode,
  signInFailure,
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

export function emailSignInTitle(state: EmailSignInState, t: Translate): string {
  if (state.step === "done") {
    return t("auth.titleDone");
  }
  return t(state.step === "code" ? "auth.titleCode" : "auth.titleSignIn");
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
      setState(codeStep(email, resend ? "auth.codeResent" : null));
    } catch (failure) {
      const error = signInFailure(failure, "auth.sendFailed");
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
      setState({ ...codeStep(email), error: signInFailure(failure, "auth.codeFailed") });
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
    onResend: () => {
      if (!billing.busy) {
        void sendCode(state.email, true);
      }
    },
    onSendCode: () => {
      if (billing.busy) {
        return;
      }
      if (!isPlausibleEmail(state.email)) {
        setState({ email: state.email, error: new LocalizedError("auth.invalidEmail"), pending: false, step: "email" });
        return;
      }
      void sendCode(normalizeEmail(state.email), false);
    },
    onVerify: () => {
      if (state.step !== "code" || billing.busy) {
        return;
      }
      if (!isCompleteCode(state.code)) {
        setState({ ...state, error: new LocalizedError("auth.enterCode") });
        return;
      }
      void verify(state.email, state.code);
    },
  };

  return { handlers, state };
}

export function EmailSignInView(props: {
  billingBusy: boolean;
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
    return <CodeEntry billingBusy={props.billingBusy} handlers={props.handlers} state={state} styles={styles} />;
  }
  return <EmailEntry billingBusy={props.billingBusy} handlers={props.handlers} state={state} styles={styles} />;
}

function EmailEntry(props: {
  billingBusy: boolean;
  handlers: EmailSignInHandlers;
  state: Extract<EmailSignInState, { step: "email" }>;
  styles: AuthStyles;
}): ReactNode {
  const { colors } = useAuthStyles();
  const ui = useUiLocale();
  const { state, styles } = props;
  const locked = state.pending || props.billingBusy;
  return (
    <View style={styles.flow}>
      <TextInput
        accessibilityLabel={ui.t("auth.emailLabel")}
        autoCapitalize="none"
        autoComplete="email"
        autoCorrect={false}
        autoFocus
        editable={!locked}
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
      <ErrorLine error={state.error} fallback="auth.sendFailed" styles={styles} />
      <PrimaryButton
        label={ui.t(state.pending ? "auth.sending" : "auth.emailMeCode")}
        onPress={props.handlers.onSendCode}
        pending={locked}
        styles={styles}
      />
    </View>
  );
}

function CodeEntry(props: {
  billingBusy: boolean;
  handlers: EmailSignInHandlers;
  state: Extract<EmailSignInState, { step: "code" }>;
  styles: AuthStyles;
}): ReactNode {
  const { colors } = useAuthStyles();
  const { t } = useUiLocale();
  const { state, styles } = props;
  const pending = state.pending !== null || props.billingBusy;
  return (
    <View style={styles.flow}>
      <PostHogMaskView>
        <EmphasisText emphasis={state.email} style={styles.body} styles={styles} text={t("auth.sentTo", { email: state.email })} />
      </PostHogMaskView>
      <TextInput
        accessibilityLabel={t("auth.codeLabel")}
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
      <ErrorLine error={state.error} fallback="auth.codeFailed" styles={styles} />
      {state.notice ? (
        <Text accessibilityLiveRegion="polite" style={styles.notice}>{t(state.notice)}</Text>
      ) : null}
      <PrimaryButton
        label={t(codeButtonLabel(state.pending))}
        onPress={props.handlers.onVerify}
        pending={pending}
        styles={styles}
      />
      <View style={styles.linkRow}>
        <TextLink disabled={pending} label={t("auth.resend")} onPress={props.handlers.onResend} styles={styles} />
        <TextLink disabled={pending} label={t("auth.changeEmail")} onPress={props.handlers.onChangeEmail} styles={styles} />
      </View>
    </View>
  );
}

function codeButtonLabel(pending: "resend" | "verify" | null): MessageKey {
  if (pending === "verify") {
    return "auth.signingIn";
  }
  return pending === "resend" ? "auth.sending" : "auth.signIn";
}

function ErrorLine(props: { error: Error | null; fallback: MessageKey; styles: AuthStyles }): ReactNode {
  const ui = useUiLocale();
  if (!props.error) {
    return null;
  }
  return (
    <Text accessibilityLiveRegion="assertive" style={props.styles.error}>
      {failureCopy(props.error, ui, props.fallback)}
    </Text>
  );
}

// Keeps the email visually emphasised wherever the translation places it.
function EmphasisText(props: {
  emphasis: string;
  live?: boolean;
  style: StyleProp<TextStyle>;
  styles: AuthStyles;
  text: string;
}): ReactNode {
  const at = props.text.indexOf(props.emphasis);
  const liveRegion = props.live ? "polite" : undefined;
  if (at < 0) {
    return <Text accessibilityLiveRegion={liveRegion} style={props.style}>{props.text}</Text>;
  }
  return (
    <Text accessibilityLiveRegion={liveRegion} style={props.style}>
      {props.text.slice(0, at)}
      <Text style={props.styles.emphasis}>{props.emphasis}</Text>
      {props.text.slice(at + props.emphasis.length)}
    </Text>
  );
}

function SignedIn(props: { doneAction: AuthDoneAction; email: string; styles: AuthStyles }): ReactNode {
  const { colors } = useAuthStyles();
  const { t } = useUiLocale();
  const { styles } = props;
  return (
    <View style={styles.flow}>
      <View accessibilityElementsHidden importantForAccessibility="no" style={styles.doneBadge}>
        <Check color={colors.selectedAccent} size={30} strokeWidth={2.5} />
      </View>
      <PostHogMaskView>
        <EmphasisText
          emphasis={props.email}
          live
          style={[styles.body, styles.centered]}
          styles={styles}
          text={t("auth.signedInAs", { email: props.email })}
        />
      </PostHogMaskView>
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
