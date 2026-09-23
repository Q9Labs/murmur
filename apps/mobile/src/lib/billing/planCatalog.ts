import type { BillingProduct } from "@murmur/protocol/billing/catalog";

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
  const monthsSaved = 12 - yearly.priceAmount / monthly.priceAmount;
  const monthsFree = Math.floor(monthsSaved + roundingTolerance);
  if (monthsFree < 1) {
    return null;
  }
  return {
    monthsFree,
    percent: Math.floor((monthsSaved / 12) * 100 + roundingTolerance),
  };
}

// Store prices are decimals, so exact ratios such as 99.90 / 9.99 can land a hair under
// a whole number. The tolerance only absorbs that float error; savings still round down.
const roundingTolerance = 1e-9;

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

// Builds US-priced plans from the shared billing catalog, for previews and screenshots
// where no store is available. Real screens always use store prices and descriptions.
export function plansFromCatalog(products: readonly BillingProduct[]): MurmurPlan[] {
  return products.flatMap((product) => {
    if (product.personalOffer === true || product.basePriceUsdCents === null) {
      return [];
    }
    return [catalogPlan(product, product.basePriceUsdCents)];
  });
}

const subscriptionDetails = {
  monthly: { periodLabel: "month", title: "Murmur Pro" },
  yearly: { periodLabel: "year", title: "Murmur Pro Annual" },
} as const;

function catalogPlan(product: BillingProduct, priceUsdCents: number): MurmurPlan {
  const minutes = Math.round(product.grantMs / 60_000);
  const term = catalogTerm(product);
  const shared = {
    id: product.revenueCatPackageId,
    price: formatUsd(priceUsdCents),
    priceAmount: priceUsdCents / 100,
  };
  if (term === "pack") {
    return {
      ...shared,
      description: `${minutes} minutes of live translation`,
      periodLabel: null,
      pricePerMonth: null,
      term,
      title: `${minutes}-minute pack`,
    };
  }
  return {
    ...shared,
    description: `${formatAllowance(minutes)} of live translation a month`,
    periodLabel: subscriptionDetails[term].periodLabel,
    pricePerMonth: term === "yearly" ? formatUsd(priceUsdCents / 12) : null,
    term,
    title: subscriptionDetails[term].title,
  };
}

function catalogTerm(product: BillingProduct): PlanTerm {
  if (product.kind === "credit_pack") {
    return "pack";
  }
  return product.code.startsWith("pro_annual") ? "yearly" : "monthly";
}

function formatAllowance(minutes: number): string {
  if (minutes % 60 !== 0) {
    return `${minutes} minutes`;
  }
  const hours = minutes / 60;
  return `${hours} ${hours === 1 ? "hour" : "hours"}`;
}

function formatUsd(cents: number): string {
  return `$${(Math.floor(cents) / 100).toFixed(2)}`;
}

export function planPurchaseLabel(plan: MurmurPlan): string {
  const suffix = planPriceSuffix(plan);
  const price = suffix ? `${plan.price} ${suffix}` : plan.price;
  return plan.term === "pack" ? `Buy for ${price}` : `Subscribe for ${price}`;
}
