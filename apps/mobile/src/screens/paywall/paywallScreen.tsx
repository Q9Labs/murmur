import { useFocusEffect, useRouter } from "expo-router";
import { X } from "lucide-react-native";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Pressable, ScrollView, StatusBar, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { isHardPaywallLocked } from "../../lib/billing/allowance";
import { useMurmurBilling } from "../../lib/billing/context";
import { formatAllowance, introRenewalLine, planDisplayPrice } from "../../lib/billing/planCatalog";
import { paywallChoices, type PaywallKey, type PaywallChoices } from "../../lib/billing/paywallChoices";
import { formatUiNumber, uiContentDirectionStyle, uiTextDirectionStyle, useUiLocale } from "../../i18n/runtime";
import { captureMobileTelemetry } from "../../lib/telemetry";
import { openLegalLink } from "../../lib/legalLinks";
import { StatusLine } from "../screenScaffold";
import { PlanListStatus, usePlanList } from "../plans/planList";
import { PlanCheckout, type PlanPurchaseMode } from "../plans/planPicker";
import { purchaseMode } from "../plans/purchaseMode";
import { usePlanStyles } from "../plans/styles";
import { PaywallDemo } from "./paywallDemo";
import { usePaywallStyles } from "./styles";

const choiceOrder: PaywallKey[] = ["pack", "monthly", "yearly"];

export function PaywallScreen({ initialKey }: { initialKey?: PaywallKey }): ReactNode {
  const router = useRouter();
  const billing = useMurmurBilling();
  const ui = useUiLocale();
  const { t } = ui;
  const { colors, styles } = usePaywallStyles();
  const loadPlans = useCallback(() => billing.loadPlans("hard_paywall"), [billing.loadPlans]);
  const { plans, refresh } = usePlanList(billing.initialized, loadPlans);
  const choices = paywallChoices(plans.status === "ready" ? plans.plans : []);
  const [selectedKey, setSelectedKey] = useState<PaywallKey | null>(initialKey ?? null);
  const activeKey = selectedKey && choices[selectedKey] ? selectedKey : choices.defaultKey;
  useEffect(() => {
    if (activeKey) {
      captureMobileTelemetry({
        event: "plan_tab_viewed", surface: "hard_paywall", tab: activeKey === "pack" ? "credit_packs" : activeKey,
      });
    }
  }, [activeKey]);
  useFocusEffect(useCallback(() => {
    if (billing.customer && !isHardPaywallLocked(billing.customer)) {
      router.dismissTo("/");
    }
  }, [billing.customer, router]));
  const mode = purchaseMode(billing, () => router.replace("/save-purchase"));
  return (
    <SafeAreaView edges={["top", "bottom"]} style={[styles.screen, uiContentDirectionStyle(ui.direction)]}>
      <StatusBar barStyle={colors.dark ? "light-content" : "dark-content"} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable accessibilityLabel={t("accessibility.close")} accessibilityRole="button" onPress={() => router.back()} style={styles.close}>
            <X color={colors.primary} size={22} />
          </Pressable>
          <View style={styles.example}>
            <View style={styles.dot} />
            <Text style={styles.exampleText}>{t("paywall.example")}</Text>
          </View>
        </View>
        <PaywallDemo />
        <View style={styles.purchase}>
          <Text accessibilityRole="header" style={[styles.heading, uiTextDirectionStyle(ui.direction)]}>{t("paywall.heading")}</Text>
          {activeKey ? (
            <PaywallOffer choices={choices} activeKey={activeKey} mode={mode} onSelect={setSelectedKey} />
          ) : <PlanListStatus onRetry={refresh} plans={plans} />}
          <StatusLine error={billing.error} notice={billing.notice} />
          <View style={styles.links}>
            <PaywallLink disabled={billing.busy || !billing.purchasesAvailable} label={t("account.restorePurchases")} onPress={() => void billing.restorePurchases()} />
            <PaywallLink label={t("paywall.allPlans")} onPress={() => router.push("/plans")} />
            <PaywallLink label={t("settings.termsOfUse")} onPress={() => void openLegalLink("terms", "billing")} />
            <PaywallLink label={t("settings.privacyPolicy")} onPress={() => void openLegalLink("privacy", "billing")} />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function PaywallOffer(props: {
  activeKey: PaywallKey;
  choices: PaywallChoices;
  mode: PlanPurchaseMode;
  onSelect: (key: PaywallKey) => void;
}): ReactNode {
  const { mode } = props;
  const plan = props.choices[props.activeKey];
  const ui = useUiLocale();
  const { t } = ui;
  const { styles } = usePaywallStyles();
  const { styles: planStyles } = usePlanStyles();
  if (!plan) {
    return null;
  }
  const renewal = introRenewalLine(plan, ui);
  const price = planDisplayPrice(plan, ui);
  const priceText = price.suffix ? `${price.price} ${price.suffix}` : price.price;
  return (
    <>
      <View accessibilityRole="tablist" style={planStyles.tabBar}>
        {choiceOrder.map((key) => {
          const choice = props.choices[key];
          if (!choice) {
            return null;
          }
          const label = key === "pack" ? choice.title : t(key === "monthly" ? "plans.tabMonthly" : "plans.tabYearly");
          return (
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: key === props.activeKey }}
              key={key}
              onPress={() => props.onSelect(key)}
              style={({ pressed }) => [planStyles.tab, styles.tab, key === props.activeKey && planStyles.tabActive, pressed && planStyles.pressed]}
            >
              <Text style={[planStyles.tabText, key === props.activeKey && planStyles.tabTextActive]}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <View accessibilityLiveRegion="polite" style={styles.details}>
        <Text style={[styles.price, uiTextDirectionStyle(ui.direction)]}>{plan.term === "pack" ? t("paywall.once", { price: priceText }) : t("paywall.subscriptionPrice", { title: plan.title, price: priceText })}</Text>
        <Text style={[styles.detail, uiTextDirectionStyle(ui.direction)]}>{plan.term === "pack"
          ? t("paywall.packDetail", { minutes: t("plans.minutes", { count: formatUiNumber(plan.minutes ?? 0, ui.locale) }) })
          : t("paywall.proDetail", { allowance: plan.minutes === null ? plan.description : formatAllowance(plan.minutes, ui) })}</Text>
        {renewal ? <Text style={[styles.detail, uiTextDirectionStyle(ui.direction)]}>{renewal}</Text> : null}
      </View>
      <PlanCheckout mode={mode} plan={plan} />
      {plan.term === "pack" ? <Text style={planStyles.caption}>{t("paywall.onePayment")}</Text> : null}
    </>
  );
}

function PaywallLink(props: { disabled?: boolean; label: string; onPress: () => void }): ReactNode {
  const { styles } = usePaywallStyles();
  return (
    <Pressable accessibilityRole="link" accessibilityLabel={props.label} accessibilityState={{ disabled: props.disabled ?? false }} disabled={props.disabled} onPress={props.onPress} style={({ pressed }) => [styles.link, (pressed || props.disabled) && styles.dimmed]}>
      <Text style={styles.linkText}>{props.label}</Text>
    </Pressable>
  );
}
