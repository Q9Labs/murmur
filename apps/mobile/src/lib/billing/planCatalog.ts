export type PlanTerm = "monthly" | "yearly" | "pack";

export type MurmurPlan = {
  description: string;
  id: string;
  periodLabel: string | null;
  price: string;
  priceAmount: number;
  pricePerMonth: string | null;
  term: PlanTerm;
  title: string;
};

export type PlanTab = {
  label: string;
  plans: MurmurPlan[];
  term: PlanTerm;
};

const tabOrder: ReadonlyArray<{ label: string; term: PlanTerm }> = [
  { label: "Monthly", term: "monthly" },
  { label: "Yearly", term: "yearly" },
  { label: "Credit packs", term: "pack" },
];

export function planTabs(plans: MurmurPlan[]): PlanTab[] {
  return tabOrder
    .map((tab) => ({ ...tab, plans: plans.filter((plan) => plan.term === tab.term) }))
    .filter((tab) => tab.plans.length > 0);
}

export function defaultPlanTerm(tabs: PlanTab[]): PlanTerm | null {
  if (tabs.some((tab) => tab.term === "yearly")) {
    return "yearly";
  }
  return tabs[0]?.term ?? null;
}

export type YearlySaving = {
  monthsFree: number;
  percent: number;
};

export function yearlySaving(yearly: MurmurPlan, plans: MurmurPlan[]): YearlySaving | null {
  const monthly = plans.find((plan) => plan.term === "monthly" && plan.periodLabel === "month");
  if (yearly.term !== "yearly" || !monthly || monthly.priceAmount <= 0) {
    return null;
  }
  const twelveMonths = monthly.priceAmount * 12;
  const percent = Math.round((1 - yearly.priceAmount / twelveMonths) * 100);
  if (percent <= 0) {
    return null;
  }
  return {
    monthsFree: Math.round(12 - yearly.priceAmount / monthly.priceAmount),
    percent,
  };
}

export function planBenefits(plan: MurmurPlan, plans: MurmurPlan[]): string[] {
  const lines = plan.description.trim() ? [plan.description.trim()] : [];
  if (plan.term === "pack") {
    return [...lines, "Never expires"];
  }
  if (plan.term === "monthly") {
    return lines;
  }
  const saving = yearlySaving(plan, plans);
  const perMonth = plan.pricePerMonth ? `${plan.pricePerMonth} a month` : null;
  const monthsFree = saving && saving.monthsFree > 0
    ? `${saving.monthsFree} ${saving.monthsFree === 1 ? "month" : "months"} free`
    : null;
  const valueLine = [perMonth, monthsFree].filter(Boolean).join(", ");
  return valueLine ? [...lines, valueLine] : lines;
}

export function planPriceSuffix(plan: MurmurPlan): string | null {
  return plan.periodLabel ? `/ ${plan.periodLabel}` : null;
}

export function planAccessibilityLabel(plan: MurmurPlan, plans: MurmurPlan[]): string {
  const suffix = planPriceSuffix(plan);
  const saving = yearlySaving(plan, plans);
  return [
    plan.title,
    suffix ? `${plan.price} ${suffix}` : plan.price,
    saving ? `Save ${saving.percent}% against monthly` : null,
  ].filter(Boolean).join(", ");
}

export function planPurchaseLabel(plan: MurmurPlan): string {
  const suffix = planPriceSuffix(plan);
  const price = suffix ? `${plan.price} ${suffix}` : plan.price;
  return plan.term === "pack" ? `Buy for ${price}` : `Subscribe for ${price}`;
}
