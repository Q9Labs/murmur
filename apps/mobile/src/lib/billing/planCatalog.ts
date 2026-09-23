export type PlanTerm = "monthly" | "yearly" | "pack";

export type PlanTier = "pro" | "pro_max";

export type PlanIntroPrice = {
  amount: number;
  price: string;
};

export type MurmurPlan = {
  description: string;
  id: string;
  // A store introductory price, present only in the personal-offer offerings.
  introPrice: PlanIntroPrice | null;
  // Minutes the plan grants (a month for subscriptions), from the shared billing catalog.
  minutes: number | null;
  periodLabel: string | null;
  price: string;
  priceAmount: number;
  pricePerMonth: string | null;
  term: PlanTerm;
  tier: PlanTier | null;
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

const packValidityLabel = "Valid 3 months";

export function planTabs(plans: MurmurPlan[]): PlanTab[] {
  return tabOrder
    .map((tab) => ({ ...tab, plans: plans.filter((plan) => plan.term === tab.term).sort(byTier) }))
    .filter((tab) => tab.plans.length > 0);
}

function byTier(first: MurmurPlan, second: MurmurPlan): number {
  return tierRank(first) - tierRank(second);
}

function tierRank(plan: MurmurPlan): number {
  if (plan.tier === "pro_max") {
    return 1;
  }
  return 0;
}

export function defaultPlanTerm(tabs: PlanTab[]): PlanTerm | null {
  if (tabs.some((tab) => tab.term === "yearly")) {
    return "yearly";
  }
  return tabs[0]?.term ?? null;
}

// Tier and display name come from the RevenueCat package ids in the pricing ladder;
// anything unknown keeps the store's own title.
export function planTier(packageId: string, term: PlanTerm): PlanTier | null {
  if (term === "pack") {
    return null;
  }
  return packageId.startsWith("promax") ? "pro_max" : "pro";
}

export function planTitle(packageId: string, tier: PlanTier | null, storeTitle: string): string {
  if (tier === "pro") {
    return "Pro";
  }
  if (tier === "pro_max") {
    return "Pro Max";
  }
  if (packageId.startsWith("trip_pass")) {
    return "Trip Pass";
  }
  if (packageId.startsWith("event_pass")) {
    return "Event Pass";
  }
  return storeTitle;
}

export function planBenefits(plan: MurmurPlan, options: { phoneAudio: boolean }): string[] {
  if (plan.term === "pack") {
    return [plan.minutes === null ? plan.description.trim() : `${plan.minutes} minutes`, packValidityLabel]
      .filter(Boolean);
  }
  const allowance = plan.minutes === null ? plan.description.trim() : `${formatAllowance(plan.minutes)} a month`;
  const lines = [introRenewalLine(plan) ?? perMonthLine(plan), allowance];
  if (plan.tier === "pro_max") {
    lines.push("Everything in Pro");
  } else {
    lines.push(options.phoneAudio ? "Phone audio and history" : "Conversation history", "Sessions up to an hour");
  }
  return lines.filter((line): line is string => Boolean(line));
}

function perMonthLine(plan: MurmurPlan): string | null {
  return plan.term === "yearly" && plan.pricePerMonth ? `${plan.pricePerMonth} a month` : null;
}

function introRenewalLine(plan: MurmurPlan): string | null {
  if (!plan.introPrice || !plan.periodLabel) {
    return null;
  }
  return `Then ${plan.price} a ${plan.periodLabel}`;
}

export function planDisplayPrice(plan: MurmurPlan): { price: string; suffix: string | null } {
  if (plan.introPrice && plan.periodLabel) {
    return { price: plan.introPrice.price, suffix: `first ${plan.periodLabel}` };
  }
  return { price: plan.price, suffix: plan.periodLabel ? `/ ${plan.periodLabel}` : null };
}

export function planAccessibilityLabel(plan: MurmurPlan, options: { phoneAudio: boolean }): string {
  const { price, suffix } = planDisplayPrice(plan);
  return [plan.title, suffix ? `${price} ${suffix}` : price, ...planBenefits(plan, options)].join(", ");
}

// Whole-percent discount of the best introductory price among the plans, for the offer banner.
export function introDiscountPercent(plans: MurmurPlan[]): number | null {
  const discounts = plans.flatMap((plan) => {
    if (!plan.introPrice || plan.priceAmount <= 0) {
      return [];
    }
    return [Math.round((1 - plan.introPrice.amount / plan.priceAmount) * 100)];
  }).filter((percent) => percent > 0);
  return discounts.length > 0 ? Math.max(...discounts) : null;
}

export function formatAllowance(minutes: number): string {
  if (minutes % 60 !== 0) {
    return `${minutes} minutes`;
  }
  const hours = minutes / 60;
  return `${hours} ${hours === 1 ? "hour" : "hours"}`;
}

export function planPurchaseLabel(plan: MurmurPlan): string {
  const { price, suffix } = planDisplayPrice(plan);
  if (plan.term === "pack") {
    return `Buy for ${price}`;
  }
  return `Subscribe for ${suffix ? `${price} ${suffix}` : price}`;
}
