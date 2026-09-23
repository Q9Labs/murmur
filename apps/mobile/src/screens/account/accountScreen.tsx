import { useRouter } from "expo-router";
import { ChevronRight } from "lucide-react-native";
import { useEffect, type ReactNode } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

import { useMurmurBilling } from "../../lib/billing/context";
import type { MurmurCustomer } from "../../lib/billing/customerResponse";
import { darkMurmurTheme, lightMurmurTheme, type MurmurTheme, useMurmurTheme } from "../../home/theme";
import { formatMinutes } from "../formatMinutes";
import { LinkRow, RowGroup } from "../rowGroup";
import { PrimaryAction, ScreenScaffold, StatusLine } from "../screenScaffold";
import { useSettingsControls } from "../settings/settingsControls";

export function AccountScreen(): ReactNode {
  const router = useRouter();
  const billing = useMurmurBilling();
  const customer = billing.customer;
  const registered = customer?.isRegistered === true;
  const locked = useSettingsControls()?.locked === true;
  const busy = billing.busy || locked;
  const storeUnavailable = busy || !billing.purchasesAvailable;
  const unsavedPurchase = customer !== null && hasUnsavedPurchase(customer);

  useEffect(reportAccountViewed, []);

  return (
    <ScreenScaffold
      footer={
        <PrimaryAction disabled={locked} label="Get more time" onPress={() => router.push("/plans")} />
      }
      title="Account"
    >
      <BalanceHero customer={customer} />
      {unsavedPurchase ? <SavePurchaseReminder onPress={() => router.push("/save-purchase")} /> : null}
      <StatusLine error={null} notice={locked ? "Stop translating to manage your account." : null} />
      {registered ? (
        <RowGroup>
          <LinkRow
            disabled={storeUnavailable}
            label="Restore purchases"
            onPress={() => void billing.restorePurchases()}
          />
          {customer !== null && customer.plan !== "free" ? (
            <LinkRow
              disabled={storeUnavailable}
              label="Manage subscription"
              onPress={() => void billing.manageSubscription()}
            />
          ) : null}
          <LinkRow
            disabled={busy}
            label={billing.syncing ? "Syncing balance…" : "Refresh balance"}
            onPress={() => void billing.refresh()}
          />
          <LinkRow
            disabled={busy}
            label="Use a different account"
            onPress={() => confirmAccountSwitch(billing.switchAccount)}
          />
        </RowGroup>
      ) : null}
      {!registered && !unsavedPurchase ? (
        <RowGroup>
          <LinkRow disabled={locked} label="Sign in" onPress={() => router.push("/sign-in")} />
        </RowGroup>
      ) : null}
      <RowGroup>
        <LinkRow
          disabled={busy}
          label="Delete account"
          onPress={() => confirmAccountDeletion(billing.deleteAccount)}
          tone="danger"
        />
      </RowGroup>
      <StatusLine error={billing.error} notice={billing.notice} />
    </ScreenScaffold>
  );
}

export function reportAccountViewed(): void {
  void import("../../lib/telemetry").then(({ captureBillingTelemetry }) => {
    captureBillingTelemetry("mobile_billing_screen_viewed");
  });
}

const planNames: Readonly<Record<MurmurCustomer["plan"], string>> = {
  free: "Free",
  pro: "Pro",
};

export function hasUnsavedPurchase(customer: MurmurCustomer): boolean {
  return !customer.isRegistered && (customer.plan !== "free" || customer.creditMs > 0);
}

export function packValidity(customer: MurmurCustomer | null): string | null {
  if (!customer || customer.creditMs <= 0 || customer.earliestExpiryAtMs === null) {
    return null;
  }
  const date = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(customer.earliestExpiryAtMs));
  return `Pack minutes valid until ${date}`;
}

function BalanceHero({ customer }: { customer: MurmurCustomer | null }): ReactNode {
  const colors = useMurmurTheme();
  const styles = colors.dark ? darkStyles : lightStyles;
  const balance = customer ? formatMinutes(customer.availableMs) : "…";
  const plan = planNames[customer?.plan ?? "free"];
  const validity = packValidity(customer);
  return (
    <View
      accessibilityLabel={[`${balance} left on the ${plan} plan`, validity].filter(Boolean).join(". ")}
      accessible
      style={styles.hero}
    >
      <Text style={styles.balance}>{balance}</Text>
      <Text style={styles.detail}>left on {plan}</Text>
      {validity ? <Text style={styles.validity}>{validity}</Text> : null}
    </View>
  );
}

function SavePurchaseReminder({ onPress }: { onPress: () => void }): ReactNode {
  const colors = useMurmurTheme();
  const styles = colors.dark ? darkStyles : lightStyles;
  return (
    <Pressable
      accessibilityHint="Sign in so your purchase stays yours on a new phone"
      accessibilityLabel="Save your purchase"
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.reminder, pressed && styles.pressed]}
    >
      <View style={styles.reminderDot} />
      <View style={styles.reminderText}>
        <Text style={styles.reminderTitle}>Save your purchase</Text>
        <Text style={styles.reminderBody}>Sign in to keep it on a new phone.</Text>
      </View>
      <ChevronRight color={colors.muted} size={20} strokeWidth={2} />
    </Pressable>
  );
}

function confirmAccountSwitch(switchAccount: () => Promise<void>): void {
  Alert.alert(
    "Use a different account?",
    "This device leaves the current account. Its balance stays safe, and you can sign in again to get it back.",
    [
      { style: "cancel", text: "Keep this account" },
      { onPress: () => void switchAccount(), text: "Switch account" },
    ],
  );
}

function confirmAccountDeletion(deleteAccount: () => Promise<void>): void {
  Alert.alert(
    "Delete your Murmur account?",
    "This deletes your sign-in and its remaining balance. App Store and Google Play subscriptions must be cancelled in the store.",
    [
      { style: "cancel", text: "Keep account" },
      { onPress: () => void deleteAccount(), style: "destructive", text: "Delete account" },
    ],
  );
}

function createAccountStyles(theme: MurmurTheme) {
  return StyleSheet.create({
    balance: {
      color: theme.primary,
      fontSize: 56,
      fontWeight: "900",
      letterSpacing: -1,
    },
    detail: {
      color: theme.secondaryText,
      fontSize: 17,
      fontWeight: "700",
    },
    pressed: {
      opacity: 0.55,
    },
    reminder: {
      alignItems: "center",
      backgroundColor: theme.surface,
      borderColor: theme.gold,
      borderRadius: 22,
      borderWidth: 1.5,
      flexDirection: "row",
      gap: 14,
      paddingHorizontal: 18,
      paddingVertical: 16,
    },
    reminderBody: {
      color: theme.secondaryText,
      fontSize: 15,
      fontWeight: "600",
      lineHeight: 21,
    },
    reminderDot: {
      backgroundColor: theme.gold,
      borderRadius: 999,
      height: 10,
      width: 10,
    },
    reminderText: {
      flex: 1,
      gap: 2,
    },
    reminderTitle: {
      color: theme.primary,
      fontSize: 17,
      fontWeight: "800",
    },
    validity: {
      color: theme.secondaryText,
      fontSize: 15,
      fontWeight: "600",
      marginTop: 8,
    },
    hero: {
      backgroundColor: theme.selected,
      borderColor: theme.selectedBorder,
      borderRadius: 28,
      borderWidth: 1,
      gap: 2,
      paddingHorizontal: 22,
      paddingVertical: 26,
    },
  });
}

const lightStyles = createAccountStyles(lightMurmurTheme);
const darkStyles = createAccountStyles(darkMurmurTheme);
