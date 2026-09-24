import { useRouter } from "expo-router";
import { ChevronRight, ShieldAlert, UserRound } from "lucide-react-native";
import { useEffect, type ReactNode } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

import type { MessageKey } from "../../i18n/catalogs/en";
import { formatUiDate, uiMirrorStyle, useUiLocale, type Translate, type UiText } from "../../i18n/runtime";
import { useMurmurBilling } from "../../lib/billing/context";
import type { MurmurCustomer } from "../../lib/billing/customerResponse";
import { darkMurmurTheme, lightMurmurTheme, type MurmurTheme, useMurmurTheme } from "../../home/theme";
import { formatMinutes } from "../formatMinutes";
import type { HeroPoint } from "../heroPoints";
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
      {unsavedPurchase ? (
        <SignInPrompt
          body={t("savePurchase.reminder")}
          hint={t("savePurchase.hint")}
          icon={ShieldAlert}
          onPress={() => router.push("/save-purchase")}
          title={t("savePurchase.title")}
          tone="attention"
        />
      ) : null}
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
        <SignInPrompt
          body={t("account.signInBenefit")}
          disabled={locked}
          hint={t("account.signInBenefit")}
          icon={UserRound}
          onPress={() => router.push("/sign-in")}
          title={t("account.signIn")}
        />
      ) : null}
      <StatusLine error={billing.error} notice={billing.notice} />
      <DeleteAccountAction disabled={busy} onPress={() => confirmAccountDeletion(billing.deleteAccount, t)} />
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
      <View style={styles.heroMarks}>
        <View style={[styles.heroMark, styles.heroMarkCoral]} />
        <View style={[styles.heroMark, styles.heroMarkTeal]} />
        <View style={[styles.heroMark, styles.heroMarkGold]} />
        <View style={[styles.heroMark, styles.heroMarkViolet]} />
      </View>
      <Text adjustsFontSizeToFit minimumFontScale={0.6} numberOfLines={1} style={styles.balance}>{balance}</Text>
      <Text style={styles.detail}>{ui.t("account.balancePlan", { plan })}</Text>
      {validity.length > 0 ? (
        <View style={styles.packs}>
          {validity.map((line) => <Text key={line} style={styles.validity}>{line}</Text>)}
        </View>
      ) : null}
    </View>
  );
}

// Why a guest should sign in, shown where they check their minutes. An unsaved purchase
// makes the same ask more pressing, so its icon carries a gold attention dot.
function SignInPrompt(props: {
  body: string;
  disabled?: boolean;
  hint: string;
  icon: HeroPoint["icon"];
  onPress: () => void;
  title: string;
  tone?: "attention";
}): ReactNode {
  const colors = useMurmurTheme();
  const styles = colors.dark ? darkStyles : lightStyles;
  const { direction } = useUiLocale();
  const Icon = props.icon;
  return (
    <Pressable
      accessibilityHint={props.hint}
      accessibilityLabel={props.title}
      accessibilityRole="button"
      accessibilityState={{ disabled: props.disabled === true }}
      disabled={props.disabled}
      onPress={props.onPress}
      style={({ pressed }) => [styles.prompt, (pressed || props.disabled) && styles.pressed]}
    >
      <View accessibilityElementsHidden importantForAccessibility="no" style={styles.promptIcon}>
        <Icon color={colors.primary} size={22} />
        {props.tone === "attention" ? <View style={styles.promptAttention} /> : null}
      </View>
      <View style={styles.promptText}>
        <Text style={styles.promptTitle}>{props.title}</Text>
        <Text style={styles.promptBody}>{props.body}</Text>
      </View>
      <View style={uiMirrorStyle(direction)}>
        <ChevronRight color={colors.muted} size={20} strokeWidth={2} />
      </View>
    </Pressable>
  );
}

// Deleting is rare and irreversible, so it is a quiet text action at the foot of the screen
// rather than a row as heavy as the ones above it.
function DeleteAccountAction(props: { disabled: boolean; onPress: () => void }): ReactNode {
  const colors = useMurmurTheme();
  const styles = colors.dark ? darkStyles : lightStyles;
  const { t } = useUiLocale();
  return (
    <Pressable
      accessibilityLabel={t("account.deleteAccount")}
      accessibilityRole="button"
      accessibilityState={{ disabled: props.disabled }}
      disabled={props.disabled}
      onPress={props.onPress}
      style={({ pressed }) => [styles.deleteAction, (pressed || props.disabled) && styles.pressed]}
    >
      <Text style={styles.deleteText}>{t("account.deleteAccount")}</Text>
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
      color: theme.onSelected,
      fontSize: 56,
      fontVariant: ["tabular-nums"],
      fontWeight: "900",
      letterSpacing: -1.2,
      lineHeight: 62,
    },
    deleteAction: {
      alignItems: "center",
      justifyContent: "center",
      marginTop: "auto",
      minHeight: 48,
    },
    deleteText: {
      color: theme.danger,
      fontSize: 16,
      fontWeight: "700",
    },
    detail: {
      color: theme.onSelectedSecondary,
      fontSize: 17,
      fontWeight: "700",
    },
    // Pack expiry is fine print under the balance, set apart by a rule in the card's own ink.
    packs: {
      borderTopColor: theme.onSelectedSecondary,
      borderTopWidth: StyleSheet.hairlineWidth,
      gap: 6,
      marginTop: 18,
      paddingTop: 16,
    },
    pressed: {
      opacity: 0.55,
    },
    prompt: {
      alignItems: "center",
      backgroundColor: theme.surface,
      borderColor: theme.hairline,
      borderRadius: 22,
      borderWidth: 1,
      flexDirection: "row",
      gap: 14,
      paddingHorizontal: 16,
      paddingVertical: 16,
    },
    promptAttention: {
      backgroundColor: theme.gold,
      borderColor: theme.surface,
      borderRadius: 999,
      borderWidth: 2,
      end: 0,
      height: 14,
      position: "absolute",
      top: 0,
      width: 14,
    },
    promptBody: {
      color: theme.secondaryText,
      fontSize: 15,
      fontWeight: "500",
      lineHeight: 20,
    },
    promptIcon: {
      alignItems: "center",
      backgroundColor: theme.input,
      borderRadius: 999,
      height: 44,
      justifyContent: "center",
      width: 44,
    },
    promptText: {
      flex: 1,
      gap: 2,
    },
    promptTitle: {
      color: theme.primary,
      fontSize: 17,
      fontWeight: "800",
    },
    validity: {
      color: theme.onSelectedSecondary,
      fontSize: 15,
      fontWeight: "600",
      lineHeight: 20,
    },
    hero: {
      backgroundColor: theme.selected,
      borderRadius: 28,
      gap: 2,
      paddingHorizontal: 24,
      paddingVertical: 24,
    },
    heroMark: {
      borderRadius: 999,
      height: 5,
    },
    heroMarkCoral: {
      backgroundColor: theme.coral,
      width: 12,
    },
    heroMarkGold: {
      backgroundColor: theme.gold,
      width: 20,
    },
    heroMarkTeal: {
      backgroundColor: theme.teal,
      width: 28,
    },
    heroMarkViolet: {
      backgroundColor: theme.violet,
      width: 12,
    },
    heroMarks: {
      flexDirection: "row",
      gap: 5,
      marginBottom: 16,
    },
  });
}

const lightStyles = createAccountStyles(lightMurmurTheme);
const darkStyles = createAccountStyles(darkMurmurTheme);
