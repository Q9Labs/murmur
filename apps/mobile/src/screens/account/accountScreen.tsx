import { useRouter } from "expo-router";
import { ChevronRight } from "lucide-react-native";
import { useEffect, type ReactNode } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

import type { MessageKey } from "../../i18n/catalogs/en";
import { formatUiDate, uiMirrorStyle, useUiLocale, type Translate, type UiText } from "../../i18n/runtime";
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
  const { t } = useUiLocale();
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
        <PrimaryAction disabled={locked} label={t("home.getMoreTime")} onPress={() => router.push("/plans")} />
      }
      title={t("account.title")}
    >
      <BalanceHero customer={customer} />
      {unsavedPurchase ? <SavePurchaseReminder onPress={() => router.push("/save-purchase")} /> : null}
      <StatusLine error={null} notice={locked ? t("account.locked") : null} />
      {registered ? (
        <RowGroup>
          <LinkRow
            disabled={storeUnavailable}
            label={t("account.restorePurchases")}
            onPress={() => void billing.restorePurchases()}
          />
          {customer !== null && customer.plan !== "free" ? (
            <LinkRow
              disabled={storeUnavailable}
              label={t("account.manageSubscription")}
              onPress={() => void billing.manageSubscription()}
            />
          ) : null}
          <LinkRow
            disabled={busy}
            label={t(billing.syncing ? "account.syncingBalance" : "account.refreshBalance")}
            onPress={() => void billing.refresh()}
          />
          <LinkRow
            disabled={busy}
            label={t("account.switchAccount")}
            onPress={() => confirmAccountSwitch(billing.switchAccount, t)}
          />
        </RowGroup>
      ) : null}
      {!registered && !unsavedPurchase ? (
        <RowGroup>
          <LinkRow disabled={locked} label={t("account.signIn")} onPress={() => router.push("/sign-in")} />
        </RowGroup>
      ) : null}
      <RowGroup>
        <LinkRow
          disabled={busy}
          label={t("account.deleteAccount")}
          onPress={() => confirmAccountDeletion(billing.deleteAccount, t)}
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

// Pro and Pro Max are product names and stay as they are in every language.
const planNames: { readonly [Plan in MurmurCustomer["plan"]]: MessageKey } = {
  free: "account.planFree",
  pro: "account.planPro",
  pro_max: "account.planProMax",
};

export function hasUnsavedPurchase(customer: MurmurCustomer): boolean {
  return !customer.isRegistered && (customer.plan !== "free" || customer.creditMs > 0);
}

// One line per credit pack still holding minutes, soonest to expire first.
export function packValidity(customer: MurmurCustomer | null, ui: UiText): string[] {
  const packs = customer?.creditPacks.filter((pack) => pack.remainingMs > 0) ?? [];
  return packs
    .sort((first, second) => first.expiresAtMs - second.expiresAtMs)
    .map((pack) => ui.t("account.packValidity", {
      date: formatUiDate(pack.expiresAtMs, ui.locale, { dateStyle: "medium" }),
      minutes: formatMinutes(pack.remainingMs, ui),
    }));
}

function BalanceHero({ customer }: { customer: MurmurCustomer | null }): ReactNode {
  const colors = useMurmurTheme();
  const styles = colors.dark ? darkStyles : lightStyles;
  const ui = useUiLocale();
  const balance = customer ? formatMinutes(customer.availableMs, ui) : "…";
  const plan = ui.t(planNames[customer?.plan ?? "free"]);
  const validity = packValidity(customer, ui);
  return (
    <View
      accessibilityLabel={[ui.t("account.balanceSpoken", { balance, plan }), ...validity].join(". ")}
      accessible
      style={styles.hero}
    >
      <Text style={styles.balance}>{balance}</Text>
      <Text style={styles.detail}>{ui.t("account.balancePlan", { plan })}</Text>
      {validity.map((line) => <Text key={line} style={styles.validity}>{line}</Text>)}
    </View>
  );
}

function SavePurchaseReminder({ onPress }: { onPress: () => void }): ReactNode {
  const colors = useMurmurTheme();
  const styles = colors.dark ? darkStyles : lightStyles;
  const { direction, t } = useUiLocale();
  return (
    <Pressable
      accessibilityHint={t("savePurchase.hint")}
      accessibilityLabel={t("savePurchase.title")}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.reminder, pressed && styles.pressed]}
    >
      <View style={styles.reminderDot} />
      <View style={styles.reminderText}>
        <Text style={styles.reminderTitle}>{t("savePurchase.title")}</Text>
        <Text style={styles.reminderBody}>{t("savePurchase.reminder")}</Text>
      </View>
      <View style={uiMirrorStyle(direction)}>
        <ChevronRight color={colors.muted} size={20} strokeWidth={2} />
      </View>
    </Pressable>
  );
}

function confirmAccountSwitch(switchAccount: () => Promise<void>, t: Translate): void {
  Alert.alert(
    t("account.switchTitle"),
    t("account.switchBody"),
    [
      { style: "cancel", text: t("account.switchKeep") },
      { onPress: () => void switchAccount(), text: t("account.switchConfirm") },
    ],
  );
}

function confirmAccountDeletion(deleteAccount: () => Promise<void>, t: Translate): void {
  Alert.alert(
    t("account.deleteTitle"),
    t("account.deleteBody"),
    [
      { style: "cancel", text: t("account.deleteKeep") },
      { onPress: () => void deleteAccount(), style: "destructive", text: t("account.deleteAccount") },
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
