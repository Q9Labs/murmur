import { Check } from "lucide-react-native";
import { useState } from "react";
import type { ReactNode } from "react";
import { Platform, Pressable, Text, View } from "react-native";

import {
  defaultPlanTerm,
  type MurmurPlan,
  planAccessibilityLabel,
  planBenefits,
  planDisplayPrice,
  planPurchaseLabel,
  type PlanTab,
  type PlanTerm,
  planTabs,
  planTermLabel,
} from "../../lib/billing/planCatalog";
import { useUiLocale } from "../../i18n/runtime";
import { type PlanStyles, usePlanStyles } from "./styles";

export type PlanPurchaseMode = { onBuy: (plan: MurmurPlan) => void; storeReady: boolean };

export type PlanPickerState = {
  activeTab: PlanTab | null;
  select: (planId: string) => void;
  selected: MurmurPlan | null;
  selectTerm: (term: PlanTerm) => void;
  tabs: PlanTab[];
};

export function usePlanPicker(plans: MurmurPlan[], initialTerm?: PlanTerm): PlanPickerState {
  const tabs = planTabs(plans);
  const [term, setTerm] = useState<PlanTerm | null>(initialTerm ?? null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const fallbackTerm = defaultPlanTerm(tabs);
  const activeTab = tabs.find((tab) => tab.term === term) ?? tabs.find((tab) => tab.term === fallbackTerm) ?? null;
  const selected = activeTab?.plans.find((plan) => plan.id === selectedId) ?? activeTab?.plans[0] ?? null;
  return {
    activeTab,
    select: setSelectedId,
    selected,
    selectTerm: (nextTerm) => {
      setTerm(nextTerm);
      setSelectedId(null);
    },
    tabs,
  };
}

const planOptions = { phoneAudio: Platform.OS === "android" };

export function PlanPicker({ picker }: { picker: PlanPickerState }): ReactNode {
  const { styles } = usePlanStyles();
  const { activeTab } = picker;
  if (!activeTab) {
    return null;
  }
  const selectable = activeTab.plans.length > 1;
  return (
    <View style={styles.picker}>
      {picker.tabs.length > 1 ? (
        <PlanTabBar activeTerm={activeTab.term} onSelect={picker.selectTerm} styles={styles} tabs={picker.tabs} />
      ) : null}
      <View accessibilityRole={selectable ? "radiogroup" : undefined} style={styles.cards}>
        {activeTab.plans.map((plan) => (
          <PlanCard
            key={plan.id}
            onSelect={() => picker.select(plan.id)}
            plan={plan}
            selectable={selectable}
            selected={plan.id === picker.selected?.id}
            styles={styles}
          />
        ))}
      </View>
    </View>
  );
}

function PlanTabBar(props: {
  activeTerm: PlanTerm;
  onSelect: (term: PlanTerm) => void;
  styles: PlanStyles;
  tabs: PlanTab[];
}): ReactNode {
  const { styles } = props;
  const ui = useUiLocale();
  return (
    <View accessibilityRole="tablist" style={styles.tabBar}>
      {props.tabs.map((tab) => {
        const active = tab.term === props.activeTerm;
        const label = planTermLabel(tab.term, ui);
        return (
          <Pressable
            accessibilityLabel={ui.t("plans.tabPlans", { tab: label })}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            key={tab.term}
            onPress={() => props.onSelect(tab.term)}
            style={({ pressed }) => [styles.tab, active && styles.tabActive, pressed && styles.pressed]}
          >
            <Text
              adjustsFontSizeToFit
              minimumFontScale={0.8}
              numberOfLines={1}
              style={[styles.tabText, active && styles.tabTextActive]}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function PlanCard(props: {
  onSelect: () => void;
  plan: MurmurPlan;
  selectable: boolean;
  selected: boolean;
  styles: PlanStyles;
}): ReactNode {
  const { plan, styles } = props;
  const ui = useUiLocale();
  const { price, suffix } = planDisplayPrice(plan, ui);
  return (
    <Pressable
      accessibilityLabel={planAccessibilityLabel(plan, planOptions, ui)}
      accessibilityRole={props.selectable ? "radio" : "summary"}
      accessibilityState={props.selectable ? { checked: props.selected } : undefined}
      disabled={!props.selectable}
      onPress={props.onSelect}
      style={({ pressed }) => [
        styles.card,
        props.selected && styles.cardSelected,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.cardHeader}>
        <Text style={[styles.cardTitle, props.selected && styles.cardTitleSelected]}>{plan.title}</Text>
        {props.selectable ? <SelectionMark selected={props.selected} styles={styles} /> : null}
      </View>
      <View style={styles.priceRow}>
        <Text style={[styles.price, props.selected && styles.priceSelected]}>{price}</Text>
        {suffix ? (
          <Text style={[styles.priceSuffix, props.selected && styles.priceSuffixSelected]}>{suffix}</Text>
        ) : null}
      </View>
      <View style={styles.benefits}>
        {planBenefits(plan, planOptions, ui).map((line) => (
          <View key={line} style={styles.benefit}>
            <View style={[styles.benefitDot, props.selected && styles.benefitDotSelected]} />
            <Text style={[styles.benefitText, props.selected && styles.benefitTextSelected]}>{line}</Text>
          </View>
        ))}
      </View>
    </Pressable>
  );
}

function SelectionMark(props: { selected: boolean; styles: PlanStyles }): ReactNode {
  const { colors } = usePlanStyles();
  return (
    <View style={[props.styles.radio, props.selected && props.styles.radioSelected]}>
      {props.selected ? <Check color={colors.selected} size={15} strokeWidth={3} /> : null}
    </View>
  );
}

export function PlanCheckout(props: { mode: PlanPurchaseMode; plan: MurmurPlan }): ReactNode {
  const { styles } = usePlanStyles();
  const ui = useUiLocale();
  const { mode, plan } = props;
  const disabled = !mode.storeReady;
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={() => mode.onBuy(plan)}
        style={({ pressed }) => [styles.cta, disabled && styles.ctaDisabled, pressed && styles.pressed]}
      >
        <Text style={[styles.ctaText, disabled && styles.ctaTextDisabled]}>{planPurchaseLabel(plan, ui)}</Text>
      </Pressable>
      {plan.term === "pack" ? null : <Text style={styles.caption}>{ui.t("plans.renewsAutomatically")}</Text>}
    </>
  );
}
