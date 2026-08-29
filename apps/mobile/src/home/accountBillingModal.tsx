import { useState } from "react";
import type { ReactNode } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { type MurmurBillingContext, useMurmurBilling } from "../lib/billing/context";
import { ModalSheet } from "./modalSheet";
import { useMurmurTheme } from "./theme";

export function AccountBillingModal(props: { onClose: () => void; open: boolean }): ReactNode {
  const billing = useMurmurBilling();
  const colors = useMurmurTheme();
  const styles = createStyles(colors);
  const balance = billing.customer ? formatMinutes(billing.customer.availableMs) : "...";

  return (
    <ModalSheet onClose={props.onClose} open={props.open} scroll title="Account & billing">
      <View style={styles.balanceCard}>
        <Text style={styles.eyebrow}>TIME AVAILABLE</Text>
        <Text style={styles.balance}>{balance}</Text>
        <Text style={styles.caption}>
          Free includes 30 minutes each month. Pro includes 3 hours each month. Credit packs never expire.
        </Text>
      </View>

      <PurchaseActions billing={billing} styles={styles} />
      <AccountRecovery billing={billing} colors={colors} styles={styles} />

      <ActionButton
        disabled={billing.busy}
        label="Delete Murmur account"
        onPress={() => confirmAccountDeletion(billing.deleteAccount)}
        styles={styles}
      />
      <Text style={styles.caption}>
        Deleting your Murmur account does not cancel an App Store or Google Play subscription.
      </Text>

      {billing.error ? <Text style={styles.error}>{billing.error}</Text> : null}
    </ModalSheet>
  );
}

function PurchaseActions(props: {
  billing: MurmurBillingContext;
  styles: ReturnType<typeof createStyles>;
}): ReactNode {
  const registered = customerIsRegistered(props.billing);
  const purchasesEnabled = customerPurchasesAreEnabled(props.billing);
  const storeUnavailable = billingStoreIsUnavailable(props.billing);
  const paywallDisabled = [storeUnavailable, !registered, !purchasesEnabled].some(Boolean);
  const restoreDisabled = [storeUnavailable, !registered].some(Boolean);
  const managesSubscription = customerHasPro(props.billing);
  return (
    <>
      <ActionButton
        disabled={paywallDisabled}
        label={paywallButtonLabel(registered, purchasesEnabled)}
        onPress={() => void props.billing.openPaywall()}
        primary
        styles={props.styles}
      />
      <ActionButton
        disabled={restoreDisabled}
        label="Restore purchases"
        onPress={() => void props.billing.restorePurchases()}
        styles={props.styles}
      />
      {managesSubscription ? (
        <ActionButton
          disabled={storeUnavailable}
          label="Manage subscription"
          onPress={() => void props.billing.manageSubscription()}
          styles={props.styles}
        />
      ) : null}
    </>
  );
}

function customerIsRegistered(billing: MurmurBillingContext): boolean {
  return billing.customer !== null && billing.customer.isRegistered;
}

function customerPurchasesAreEnabled(billing: MurmurBillingContext): boolean {
  return billing.customer !== null && billing.customer.purchasesEnabled;
}

function customerHasPro(billing: MurmurBillingContext): boolean {
  return billing.customer !== null && billing.customer.plan === "pro";
}

function billingStoreIsUnavailable(billing: MurmurBillingContext): boolean {
  return billing.busy || !billing.purchasesAvailable;
}

function paywallButtonLabel(registered: boolean, purchasesEnabled: boolean): string {
  if (!registered) {
    return "Add an email to view Pro and packs";
  }
  return purchasesEnabled
    ? "View Pro and credit packs"
    : "Purchases are temporarily unavailable";
}

function AccountRecovery(props: {
  billing: MurmurBillingContext;
  colors: ReturnType<typeof useMurmurTheme>;
  styles: ReturnType<typeof createStyles>;
}): ReactNode {
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function sendCode(): Promise<void> {
    const normalized = email.trim().toLowerCase();
    if (!normalized.includes("@")) {
      setMessage("Enter a valid email address.");
      return;
    }
    try {
      await props.billing.sendSignInCode(normalized);
      setCodeSent(true);
      setMessage("We sent a six-digit code. It expires in 10 minutes.");
    } catch {
      setMessage(null);
    }
  }

  async function verifyCode(): Promise<void> {
    if (!/^\d{6}$/.test(otp.trim())) {
      setMessage("Enter the six-digit code.");
      return;
    }
    try {
      await props.billing.verifySignInCode(email.trim().toLowerCase(), otp.trim());
      setCodeSent(false);
      setOtp("");
      setMessage("Your Murmur account is now recoverable on another device.");
    } catch {
      setMessage(null);
    }
  }

  if (props.billing.customer?.isRegistered) {
    return <Text style={props.styles.caption}>This balance is protected by your Murmur account.</Text>;
  }
  return (
    <View style={props.styles.accountSection}>
      <Text style={props.styles.heading}>Protect your balance</Text>
      <Text style={props.styles.caption}>
        Add an email so your plan and unused credits can follow you to another device.
      </Text>
      <TextInput
        autoCapitalize="none"
        autoComplete="email"
        editable={!props.billing.busy && !codeSent}
        inputMode="email"
        onChangeText={setEmail}
        placeholder="you@example.com"
        placeholderTextColor={props.colors.muted}
        style={props.styles.input}
        value={email}
      />
      {codeSent ? (
        <TextInput
          autoComplete="one-time-code"
          editable={!props.billing.busy}
          inputMode="numeric"
          maxLength={6}
          onChangeText={setOtp}
          placeholder="6-digit code"
          placeholderTextColor={props.colors.muted}
          style={props.styles.input}
          value={otp}
        />
      ) : null}
      <ActionButton
        disabled={props.billing.busy}
        label={codeSent ? "Verify code" : "Send sign-in code"}
        onPress={() => void (codeSent ? verifyCode() : sendCode())}
        styles={props.styles}
      />
      {message ? <Text style={props.styles.message}>{message}</Text> : null}
    </View>
  );
}

function confirmAccountDeletion(deleteAccount: () => Promise<void>): void {
  Alert.alert(
    "Delete Murmur account?",
    "This deletes your sign-in and access to its remaining balance. Store subscriptions must be cancelled separately.",
    [
      { style: "cancel", text: "Keep account" },
      {
        onPress: () => void deleteAccount(),
        style: "destructive",
        text: "Delete account",
      },
    ],
  );
}

function ActionButton(props: {
  disabled: boolean;
  label: string;
  onPress: () => void;
  primary?: boolean;
  styles: ReturnType<typeof createStyles>;
}): ReactNode {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={props.disabled}
      onPress={props.onPress}
      style={({ pressed }) => [
        props.styles.button,
        props.primary && props.styles.primaryButton,
        (pressed || props.disabled) && props.styles.disabled,
      ]}
    >
      <Text style={[props.styles.buttonText, props.primary && props.styles.primaryButtonText]}>
        {props.label}
      </Text>
    </Pressable>
  );
}

function formatMinutes(milliseconds: number): string {
  const minutes = Math.max(0, Math.ceil(milliseconds / 60_000));
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours} hr ${remainder} min` : `${hours} hr`;
}

function createStyles(colors: ReturnType<typeof useMurmurTheme>) {
  return StyleSheet.create({
    accountSection: { gap: 12, marginTop: 24 },
    balance: { color: colors.primary, fontSize: 34, fontWeight: "900", marginTop: 4 },
    balanceCard: {
      backgroundColor: colors.selected,
      borderColor: colors.selectedBorder,
      borderRadius: 20,
      borderWidth: 1,
      marginBottom: 16,
      padding: 18,
    },
    button: {
      alignItems: "center",
      borderColor: colors.hairline,
      borderRadius: 16,
      borderWidth: 1,
      justifyContent: "center",
      marginTop: 10,
      minHeight: 52,
      paddingHorizontal: 16,
    },
    buttonText: { color: colors.primary, fontSize: 16, fontWeight: "800" },
    caption: { color: colors.muted, fontSize: 14, fontWeight: "600", lineHeight: 20 },
    disabled: { opacity: 0.45 },
    error: { color: "#B33A3A", fontSize: 13, fontWeight: "700", marginTop: 14 },
    eyebrow: { color: colors.teal, fontSize: 12, fontWeight: "900", letterSpacing: 1.2 },
    heading: { color: colors.primary, fontSize: 18, fontWeight: "900" },
    input: {
      backgroundColor: colors.input,
      borderColor: colors.hairline,
      borderRadius: 16,
      borderWidth: 1,
      color: colors.primary,
      fontSize: 16,
      minHeight: 52,
      paddingHorizontal: 16,
    },
    message: { color: colors.muted, fontSize: 13, fontWeight: "700", marginTop: 14 },
    primaryButton: { backgroundColor: colors.primary, borderColor: colors.primary },
    primaryButtonText: { color: colors.background },
  });
}
