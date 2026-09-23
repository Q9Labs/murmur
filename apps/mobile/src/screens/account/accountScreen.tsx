import { useRouter } from "expo-router";
import { useEffect, type ReactNode } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";

import { useMurmurBilling } from "../../lib/billing/context";
import type { MurmurCustomer } from "../../lib/billing/customerResponse";
import { darkMurmurTheme, lightMurmurTheme, type MurmurTheme, useMurmurTheme } from "../../home/theme";
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

  useEffect(reportAccountViewed, []);

  return (
    <ScreenScaffold
      footer={
        <PrimaryAction disabled={locked} label="Get more time" onPress={() => router.push("/plans")} />
      }
      title="Account"
    >
      <BalanceHero customer={customer} />
      <StatusLine error={null} notice={locked ? "Stop translating to manage your account." : null} />
      {registered ? (
        <RowGroup>
          <LinkRow
            disabled={storeUnavailable}
            label="Restore purchases"
            onPress={() => void billing.restorePurchases()}
          />
          {customer?.plan === "pro" ? (
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
      ) : (
        <RowGroup>
          <LinkRow disabled={locked} label="Sign in" onPress={() => router.push("/sign-in")} />
        </RowGroup>
      )}
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

function BalanceHero({ customer }: { customer: MurmurCustomer | null }): ReactNode {
  const colors = useMurmurTheme();
  const styles = colors.dark ? darkStyles : lightStyles;
  const balance = customer ? formatMinutes(customer.availableMs) : "…";
  const plan = customer?.plan === "pro" ? "Pro" : "Free";
  return (
    <View
      accessibilityLabel={`${balance} left on the ${plan} plan`}
      accessible
      style={styles.hero}
    >
      <Text style={styles.balance}>{balance}</Text>
      <Text style={styles.detail}>left on {plan}</Text>
    </View>
  );
}

export function formatMinutes(milliseconds: number): string {
  const minutes = Math.max(0, Math.ceil(milliseconds / 60_000));
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours} hr ${remainder} min` : `${hours} hr`;
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
