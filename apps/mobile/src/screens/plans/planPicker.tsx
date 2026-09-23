import { Check } from "lucide-react-native";
import { useState } from "react";
import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";

import {
  defaultPlanTerm,
  type MurmurPlan,
  planAccessibilityLabel,
  planBenefits,
  planPriceSuffix,
  planPurchaseLabel,
  type PlanTab,
  type PlanTerm,
  planTabs,
} from "../../lib/billing/planCatalog";
import { type PlanStyles, usePlanStyles } from "./styles";

export type PlanPurchaseMode =
  | { kind: "buy"; onBuy: (plan: MurmurPlan) => void; storeReady: boolean }
  | { kind: "sign_up"; onSignUp: (plan: MurmurPlan) => void };

export function PlanPicker(props: {
  initialTerm?: PlanTerm;
  mode: PlanPurchaseMode;
  plans: MurmurPlan[];
}): ReactNode {
  const { styles } = usePlanStyles();
  const tabs = planTabs(props.plans);
  const fallbackTerm = defaultPlanTerm(tabs);
  const [term, setTerm] = useState<PlanTerm | null>(props.initialTerm ?? fallbackTerm);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const activeTab = tabs.find((tab) => tab.term === term) ?? tabs.find((tab) => tab.term === fallbackTerm);
  if (!activeTab) {
    return null;
  }
  const selected = activeTab.plans.find((plan) => plan.id === selectedId) ?? activeTab.plans[0];

  return (
    <View style={styles.picker}>
      {tabs.length > 1 ? (
        <PlanTabBar
          activeTerm={activeTab.term}
          onSelect={(nextTerm) => {
            setTerm(nextTerm);
            setSelectedId(null);
          }}
          styles={styles}
          tabs={tabs}
        />
      ) : null}
      <View style={styles.cards}>
        {activeTab.plans.map((plan) => (
          <PlanCard
            key={plan.id}
            onSelect={() => setSelectedId(plan.id)}
            plan={plan}
            plans={props.plans}
            selectable={activeTab.plans.length > 1}
            selected={plan.id === selected?.id}
            styles={styles}
          />
        ))}
      </View>
      {selected ? <PlanCta mode={props.mode} plan={selected} styles={styles} /> : null}
      {selected && selected.term !== "pack" ? (
        <Text style={styles.caption}>Renews automatically. Cancel anytime.</Text>
      ) : null}
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
  return (
    <View accessibilityRole="tablist" style={styles.tabBar}>
      {props.tabs.map((tab) => {
        const active = tab.term === props.activeTerm;
        return (
          <Pressable
            accessibilityLabel={`${tab.label} plans`}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            key={tab.term}
            onPress={() => props.onSelect(tab.term)}
            style={({ pressed }) => [styles.tab, active && styles.tabActive, pressed && styles.pressed]}
          >
            <Text style={[styles.tabText, active && styles.tabTextActive]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function PlanCard(props: {
  onSelect: () => void;
  plan: MurmurPlan;
  plans: MurmurPlan[];
  selectable: boolean;
  selected: boolean;
  styles: PlanStyles;
}): ReactNode {
  const { plan, styles } = props;
  const suffix = planPriceSuffix(plan);
  return (
    <Pressable
      accessibilityLabel={planAccessibilityLabel(plan, props.plans)}
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
        <Text style={styles.cardTitle}>{plan.title}</Text>
        {props.selectable ? <SelectionMark selected={props.selected} styles={styles} /> : null}
      </View>
      <View style={styles.priceRow}>
        <Text style={styles.price}>{plan.price}</Text>
        {suffix ? <Text style={styles.priceSuffix}>{suffix}</Text> : null}
      </View>
      <View style={styles.benefits}>
        {planBenefits(plan, props.plans).map((line) => (
          <View key={line} style={styles.benefit}>
            <View style={styles.benefitDot} />
            <Text style={styles.benefitText}>{line}</Text>
          </View>
        ))}
      </View>
    </Pressable>
  );
}

function SelectionMark(props: { selected: boolean; styles: PlanStyles }): ReactNode {
  const { colors } = usePlanStyles();
  const checkColor = colors.dark ? colors.onPrimary : colors.primary;
  return (
    <View style={[props.styles.radio, props.selected && props.styles.radioSelected]}>
      {props.selected ? <Check color={checkColor} size={15} strokeWidth={3} /> : null}
    </View>
  );
}

function PlanCta(props: { mode: PlanPurchaseMode; plan: MurmurPlan; styles: PlanStyles }): ReactNode {
  const { mode, plan, styles } = props;
  const disabled = mode.kind === "buy" && !mode.storeReady;
  const label = mode.kind === "sign_up" ? "Sign up to buy" : planPurchaseLabel(plan);
  return (
    <Pressable
      accessibilityHint={mode.kind === "sign_up" ? "Add your email, then buy this plan" : undefined}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => {
        if (mode.kind === "sign_up") {
          mode.onSignUp(plan);
          return;
        }
        mode.onBuy(plan);
      }}
      style={({ pressed }) => [styles.cta, disabled && styles.ctaDisabled, pressed && styles.pressed]}
    >
      <Text style={[styles.ctaText, disabled && styles.ctaTextDisabled]}>{label}</Text>
    </Pressable>
  );
}
