import { useFocusEffect, useRouter } from "expo-router";
import { CalendarX, Check, ChevronLeft, CreditCard, Headphones } from "lucide-react-native";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Platform, Pressable, ScrollView, StatusBar, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { isHardPaywallLocked } from "../../lib/billing/allowance";
import { useMurmurBilling } from "../../lib/billing/context";
import {
  formatAllowance,
  introRenewalLine,
  type MurmurPlan,
  planDisplayPrice,
  planTermLabel,
} from "../../lib/billing/planCatalog";
import { paywallChoices, type PaywallKey, type PaywallChoices } from "../../lib/billing/paywallChoices";
import { formatUiNumber, uiContentDirectionStyle, uiTextDirectionStyle, useUiLocale } from "../../i18n/runtime";
import { captureMobileTelemetry } from "../../lib/telemetry";
import { openLegalLink } from "../../lib/legalLinks";
import { uiMirrorStyle } from "../../i18n/runtime";
import { StatusLine } from "../screenScaffold";
import { type PlanListState, PlanListStatus, usePlanList } from "../plans/planList";
import { PlanCheckout, type PlanPurchaseMode } from "../plans/planPicker";
import { purchaseMode } from "../plans/purchaseMode";
import { usePersonalOffer } from "../plans/offerBanner";
import { usePaywallStyles } from "./styles";

const choiceOrder: PaywallKey[] = ["pack", "monthly", "yearly"];

function storeName(): string {
  return Platform.OS === "ios" ? "App Store" : "Google Play";
}

function usePaywallSelection(plans: PlanListState, initialKey?: PaywallKey): {
  activeKey: PaywallKey | null;
  choices: PaywallChoices;
  displayedPlan: MurmurPlan | undefined;
  onSelect: (key: PaywallKey) => void;
} {
  const choices = paywallChoices(plans.status === "ready" ? plans.plans : []);
  const [selectedKey, setSelectedKey] = useState<PaywallKey | null>(initialKey ?? null);
  const activeKey = selectedKey && choices[selectedKey] ? selectedKey : choices.defaultKey;
  const displayedPlan = activeKey ? choices[activeKey] : undefined;
  useEffect(() => {
    if (activeKey) {
      captureMobileTelemetry({
        event: "plan_tab_viewed", surface: "hard_paywall", tab: activeKey === "pack" ? "credit_packs" : activeKey,
      });
    }
  }, [activeKey]);
  return { activeKey, choices, displayedPlan, onSelect: setSelectedKey };
}

export function PaywallScreen({ initialKey }: { initialKey?: PaywallKey }): ReactNode {
  const router = useRouter();
  const billing = useMurmurBilling();
  const ui = useUiLocale();
  const { t } = ui;
  const { colors, styles } = usePaywallStyles();
  const loadPlans = useCallback(() => billing.loadPlans("hard_paywall"), [billing.loadPlans]);
  const { plans, refresh } = usePlanList(billing.initialized, loadPlans);
  const { activeKey, choices, displayedPlan, onSelect } = usePaywallSelection(plans, initialKey);
  usePersonalOffer(billing.config.personalOffer, displayedPlan ? [displayedPlan] : []);
  useFocusEffect(useCallback(() => {
    if (billing.customer && !isHardPaywallLocked(billing.customer)) {
      router.dismissTo("/");
    }
  }, [billing.customer, router]));
  const mode = purchaseMode(billing, () => router.replace("/save-purchase"), "hard_paywall");
  const cancelled = billing.notice === t("billing.noPurchase");
  const storeBlocked = plans.status === "ready" && !billing.purchasesAvailable;
  return (
    <SafeAreaView edges={["top", "bottom"]} style={[styles.screen, uiContentDirectionStyle(ui.direction)]}>
      <StatusBar barStyle={colors.dark ? "light-content" : "dark-content"} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <BackRow label={t("common.back")} onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} />
        <View style={styles.purchase}>
          <Text accessibilityRole="header" style={[styles.heading, uiTextDirectionStyle(ui.direction)]}>
            {t("paywall.heroTitle")}
          </Text>
          <Text style={[styles.lead, uiTextDirectionStyle(ui.direction)]}>{t("paywall.heroSub")}</Text>
          <PaywallCatalog
            activeKey={activeKey}
            choices={choices}
            mode={mode}
            onRetry={refresh}
            onSelect={onSelect}
            plans={plans}
          />
          <PaywallStatus
            cancelled={cancelled}
            error={billing.error}
            notice={billing.notice}
            storeBlocked={storeBlocked}
          />
          <PaywallLinks
            busy={billing.busy}
            onAllPlans={() => router.push("/plans")}
            onRestore={() => void billing.restorePurchases()}
            onSignIn={() => router.push("/sign-in")}
            purchasesAvailable={billing.purchasesAvailable}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function BackRow(props: { label: string; onPress: () => void }): ReactNode {
  const { colors, styles } = usePaywallStyles();
  const { direction } = useUiLocale();
  return (
    <Pressable
      accessibilityLabel={props.label}
      accessibilityRole="button"
      hitSlop={8}
      onPress={props.onPress}
      style={({ pressed }) => [styles.backRow, pressed && styles.dimmed]}
    >
      <View style={uiMirrorStyle(direction)}>
        <ChevronLeft color={colors.primary} size={22} strokeWidth={2.25} />
      </View>
      <Text style={styles.backText}>{props.label}</Text>
    </Pressable>
  );
}

function PaywallCatalog(props: {
  activeKey: PaywallKey | null;
  choices: PaywallChoices;
  mode: PlanPurchaseMode;
  onRetry: () => void;
  onSelect: (key: PaywallKey) => void;
  plans: PlanListState;
}): ReactNode {
  if (!props.activeKey) {
    return <PlanListStatus onRetry={props.onRetry} plans={props.plans} />;
  }
  const plan = props.choices[props.activeKey];
  if (!plan) {
    return <PlanListStatus onRetry={props.onRetry} plans={props.plans} />;
  }
  return (
    <>
      <FactRows plan={plan} />
      <PlanCards activeKey={props.activeKey} choices={props.choices} onSelect={props.onSelect} />
      <PlanCheckout mode={props.mode} plan={plan} />
    </>
  );
}

function FactRows(props: { plan: MurmurPlan }): ReactNode {
  const ui = useUiLocale();
  const { colors, styles } = usePaywallStyles();
  const { t } = ui;
  const store = storeName();
  const facts: { icon: ReactNode; text: string }[] = [
    { icon: <Headphones color={colors.primary} size={20} />, text: t("paywall.factHeadphones") },
    {
      icon: <CreditCard color={colors.primary} size={20} />,
      text: props.plan.term === "pack"
        ? t("paywall.factOnce", { store })
        : t("paywall.factBilled", { store, term: planTermLabel(props.plan.term, ui).toLowerCase() }),
    },
  ];
  if (props.plan.term !== "pack") {
    facts.push({ icon: <CalendarX color={colors.primary} size={20} />, text: t("paywall.factCancel", { store }) });
  }
  return (
    <View style={styles.facts}>
      {facts.map((fact, index) => (
        <View key={index} style={styles.factRow}>
          {fact.icon}
          <Text style={[styles.factText, uiTextDirectionStyle(ui.direction)]}>{fact.text}</Text>
        </View>
      ))}
    </View>
  );
}

function PlanCards(props: {
  activeKey: PaywallKey;
  choices: PaywallChoices;
  onSelect: (key: PaywallKey) => void;
}): ReactNode {
  const { styles } = usePaywallStyles();
  return (
    <View accessibilityRole="radiogroup" style={styles.planCards}>
      {choiceOrder.map((key) => {
        const plan = props.choices[key];
        return plan ? (
          <PlanCard activeKey={props.activeKey} key={key} onSelect={props.onSelect} plan={plan} planKey={key} />
        ) : null;
      })}
    </View>
  );
}

function PlanCard(props: {
  activeKey: PaywallKey;
  onSelect: (key: PaywallKey) => void;
  plan: MurmurPlan;
  planKey: PaywallKey;
}): ReactNode {
  const ui = useUiLocale();
  const { t } = ui;
  const { colors, styles } = usePaywallStyles();
  const plan = props.plan;
  const selected = props.planKey === props.activeKey;
  const price = planDisplayPrice(plan, ui);
  const priceText = price.suffix ? `${price.price} ${price.suffix}` : price.price;
  const renewal = introRenewalLine(plan, ui);
  const detail = plan.term === "pack"
    ? t("paywall.packDetail", { minutes: t("plans.minutes", { count: formatUiNumber(plan.minutes ?? 0, ui.locale) }) })
    : t("paywall.proDetail", { allowance: plan.minutes === null ? plan.description : formatAllowance(plan.minutes, ui) });
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={() => props.onSelect(props.planKey)}
      style={({ pressed }) => [styles.planCard, selected && styles.planCardSelected, pressed && styles.dimmed]}
    >
      <View style={styles.planCardText}>
        <Text style={[styles.planCardTitle, uiTextDirectionStyle(ui.direction)]}>
          {plan.term === "pack" ? plan.title : `${plan.title} · ${priceText}`}
        </Text>
        <Text style={[styles.planCardDetail, uiTextDirectionStyle(ui.direction)]}>
          {plan.term === "pack"
            ? `${detail} · ${priceText}`
            : renewal ? `${detail} · ${renewal}` : detail}
        </Text>
      </View>
      {selected ? <Check color={colors.primary} size={20} strokeWidth={2.75} /> : null}
    </Pressable>
  );
}

function PaywallStatus(props: {
  cancelled: boolean;
  error: string | null;
  notice: string | null;
  storeBlocked: boolean;
}): ReactNode {
  const { t } = useUiLocale();
  if (props.storeBlocked) {
    return <NoticeCard body={t("paywall.storeUnavailableBody")} title={t("paywall.storeUnavailable")} />;
  }
  if (props.cancelled) {
    return <NoticeCard body={t("paywall.cancelledBody")} title={t("paywall.cancelled")} />;
  }
  return <StatusLine error={props.error} notice={props.notice} />;
}

function NoticeCard(props: { body: string; title: string }): ReactNode {
  const ui = useUiLocale();
  const { styles } = usePaywallStyles();
  return (
    <View accessibilityLiveRegion="polite" style={styles.noticeCard}>
      <Text style={[styles.noticeTitle, uiTextDirectionStyle(ui.direction)]}>{props.title}</Text>
      <Text style={[styles.noticeBody, uiTextDirectionStyle(ui.direction)]}>{props.body}</Text>
    </View>
  );
}

function PaywallLinks(props: {
  busy: boolean;
  onAllPlans: () => void;
  onRestore: () => void;
  onSignIn: () => void;
  purchasesAvailable: boolean;
}): ReactNode {
  const ui = useUiLocale();
  const { t } = ui;
  const { styles } = usePaywallStyles();
  return (
    <View style={styles.links}>
      <PaywallLink
        disabled={props.busy || !props.purchasesAvailable}
        label={t("account.restorePurchases")}
        onPress={props.onRestore}
      />
      <PaywallLink label={t("paywall.signIn")} onPress={props.onSignIn} />
      <PaywallLink label={t("paywall.allPlans")} onPress={props.onAllPlans} />
      <PaywallLink label={t("settings.termsOfUse")} onPress={() => void openLegalLink("terms", "billing")} />
      <PaywallLink label={t("settings.privacyPolicy")} onPress={() => void openLegalLink("privacy", "billing")} />
    </View>
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
