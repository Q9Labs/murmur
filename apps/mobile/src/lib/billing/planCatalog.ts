import type { MessageKey } from "../../i18n/catalogs/en";
import { formatUiNumber, type UiText } from "../../i18n/runtime";

export type PlanTerm = "monthly" | "yearly" | "pack";

// The store billing period of a subscription, rendered through the catalog.
export type PlanPeriod = "week" | "month" | "quarter" | "halfYear" | "year";

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
  period: PlanPeriod | null;
  price: string;
  priceAmount: number;
  pricePerMonth: string | null;
  term: PlanTerm;
  tier: PlanTier | null;
  title: string;
};

export type PlanTab = {
  plans: MurmurPlan[];
  term: PlanTerm;
};

const tabOrder: readonly PlanTerm[] = ["monthly", "yearly", "pack"];

const termLabelKeys: { readonly [Term in PlanTerm]: MessageKey } = {
  monthly: "plans.tabMonthly",
  yearly: "plans.tabYearly",
  pack: "plans.tabPacks",
};

type PeriodCopy = { readonly first: MessageKey; readonly per: MessageKey; readonly renewal: MessageKey };

const periodKeys: { readonly [Period in PlanPeriod]: PeriodCopy } = {
  week: { first: "plans.firstWeek", per: "plans.perWeek", renewal: "plans.renewsWeek" },
  month: { first: "plans.firstMonth", per: "plans.perMonth", renewal: "plans.renewsMonth" },
  quarter: { first: "plans.firstQuarter", per: "plans.perQuarter", renewal: "plans.renewsQuarter" },
  halfYear: { first: "plans.firstHalfYear", per: "plans.perHalfYear", renewal: "plans.renewsHalfYear" },
  year: { first: "plans.firstYear", per: "plans.perYear", renewal: "plans.renewsYear" },
};

export function planTermLabel(term: PlanTerm, ui: UiText): string {
  return ui.t(termLabelKeys[term]);
}

export function planTabs(plans: MurmurPlan[]): PlanTab[] {
  return tabOrder
    .map((term) => ({ plans: plans.filter((plan) => plan.term === term).sort(byTier), term }))
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

export function planBenefits(plan: MurmurPlan, options: { phoneAudio: boolean }, ui: UiText): string[] {
  if (plan.term === "pack") {
    const amount = plan.minutes === null ? plan.description.trim() : formatPlanMinutes(plan.minutes, ui);
    return [amount, ui.t("plans.packValidity")].filter(Boolean);
  }
  const allowance = plan.minutes === null
    ? plan.description.trim()
    : ui.t("plans.allowancePerMonth", { allowance: formatAllowance(plan.minutes, ui) });
  const lines = [introRenewalLine(plan, ui) ?? perMonthLine(plan, ui), allowance];
  if (plan.tier === "pro_max") {
    lines.push(ui.t("plans.everythingInPro"));
  } else {
    lines.push(
      ui.t(options.phoneAudio ? "plans.phoneAudioAndHistory" : "plans.conversationHistory"),
      ui.t("plans.longSessions"),
    );
  }
  return lines.filter((line): line is string => Boolean(line));
}

function perMonthLine(plan: MurmurPlan, ui: UiText): string | null {
  return plan.term === "yearly" && plan.pricePerMonth
    ? ui.t("plans.pricePerMonth", { price: plan.pricePerMonth })
    : null;
}

function introRenewalLine(plan: MurmurPlan, ui: UiText): string | null {
  if (!plan.introPrice || !plan.period) {
    return null;
  }
  return ui.t(periodKeys[plan.period].renewal, { price: plan.price });
}

export function planDisplayPrice(plan: MurmurPlan, ui: UiText): { price: string; suffix: string | null } {
  if (plan.introPrice && plan.period) {
    return { price: plan.introPrice.price, suffix: ui.t(periodKeys[plan.period].first) };
  }
  return { price: plan.price, suffix: plan.period ? ui.t(periodKeys[plan.period].per) : null };
}

export function planAccessibilityLabel(plan: MurmurPlan, options: { phoneAudio: boolean }, ui: UiText): string {
  const { price, suffix } = planDisplayPrice(plan, ui);
  return [plan.title, suffix ? `${price} ${suffix}` : price, ...planBenefits(plan, options, ui)].join(", ");
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

export function formatAllowance(minutes: number, ui: UiText): string {
  if (minutes % 60 !== 0) {
    return formatPlanMinutes(minutes, ui);
  }
  const hours = minutes / 60;
  return ui.t(hours === 1 ? "plans.oneHour" : "plans.hours", { count: formatUiNumber(hours, ui.locale) });
}

function formatPlanMinutes(minutes: number, ui: UiText): string {
  return ui.t("plans.minutes", { count: formatUiNumber(minutes, ui.locale, { grouping: true }) });
}

export function planPurchaseLabel(plan: MurmurPlan, ui: UiText): string {
  const { price, suffix } = planDisplayPrice(plan, ui);
  if (plan.term === "pack") {
    return ui.t("plans.buyFor", { price });
  }
  return ui.t("plans.subscribeFor", { price: suffix ? `${price} ${suffix}` : price });
}
