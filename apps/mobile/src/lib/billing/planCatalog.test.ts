import { describe, expect, it } from "vitest";

import {
  defaultPlanTerm,
  formatAllowance,
  introDiscountPercent,
  type MurmurPlan,
  planAccessibilityLabel,
  planBenefits,
  planDisplayPrice,
  planPurchaseLabel,
  planTabs,
  planTier,
  planTitle,
} from "./planCatalog";

function plan(overrides: Partial<MurmurPlan> & Pick<MurmurPlan, "id" | "term">): MurmurPlan {
  return {
    description: "",
    introPrice: null,
    minutes: null,
    periodLabel: null,
    price: "$0",
    priceAmount: 0,
    pricePerMonth: null,
    tier: null,
    title: overrides.id,
    ...overrides,
  };
}

const monthly = plan({
  id: "$rc_monthly",
  minutes: 120,
  periodLabel: "month",
  price: "$9.99",
  priceAmount: 9.99,
  term: "monthly",
  tier: "pro",
  title: "Pro",
});
const maxMonthly = plan({
  id: "promax_monthly",
  minutes: 400,
  periodLabel: "month",
  price: "$29.99",
  priceAmount: 29.99,
  term: "monthly",
  tier: "pro_max",
  title: "Pro Max",
});
const yearly = plan({
  id: "$rc_annual",
  minutes: 120,
  periodLabel: "year",
  price: "$99.99",
  priceAmount: 99.99,
  pricePerMonth: "$8.33",
  term: "yearly",
  tier: "pro",
  title: "Pro",
});
const pack = plan({
  id: "trip_pass_60",
  minutes: 60,
  price: "$7.99",
  priceAmount: 7.99,
  term: "pack",
  title: "Trip Pass",
});
const android = { phoneAudio: true };
const ios = { phoneAudio: false };

describe("plan catalog", () => {
  it("orders tabs Monthly, Yearly, Credit packs, Pro before Pro Max, and hides empty tabs", () => {
    const tabs = planTabs([pack, maxMonthly, yearly, monthly]);
    expect(tabs.map((tab) => tab.label)).toEqual(["Monthly", "Yearly", "Credit packs"]);
    expect(tabs[0]?.plans.map((candidate) => candidate.title)).toEqual(["Pro", "Pro Max"]);
    expect(planTabs([pack]).map((tab) => tab.term)).toEqual(["pack"]);
  });

  it("pre-selects Yearly when the offering has it", () => {
    expect(defaultPlanTerm(planTabs([monthly, yearly, pack]))).toBe("yearly");
    expect(defaultPlanTerm(planTabs([monthly, pack]))).toBe("monthly");
    expect(defaultPlanTerm([])).toBeNull();
  });

  it("names tiers and passes from the ladder's package ids", () => {
    expect(planTier("$rc_monthly", "monthly")).toBe("pro");
    expect(planTier("promax_annual", "yearly")).toBe("pro_max");
    expect(planTier("trip_pass_60", "pack")).toBeNull();
    expect(planTitle("x", "pro", "Murmur Pro")).toBe("Pro");
    expect(planTitle("x", "pro_max", "Murmur Pro Max")).toBe("Pro Max");
    expect(planTitle("trip_pass_30", null, "Trip Pass, 30 minutes")).toBe("Trip Pass");
    expect(planTitle("event_pass_300", null, "Event Pass, 300 minutes")).toBe("Event Pass");
    expect(planTitle("credits_60", null, "60-minute pack")).toBe("60-minute pack");
  });

  it("writes short benefit lines per plan", () => {
    expect(planBenefits(monthly, android)).toEqual([
      "2 hours a month",
      "Phone audio and history",
      "Sessions up to an hour",
    ]);
    expect(planBenefits(monthly, ios)).toEqual(["2 hours a month", "Conversation history", "Sessions up to an hour"]);
    expect(planBenefits(yearly, ios)[0]).toBe("$8.33 a month");
    expect(planBenefits(maxMonthly, ios)).toEqual(["400 minutes a month", "Everything in Pro"]);
    expect(planBenefits(pack, ios)).toEqual(["60 minutes", "Valid 3 months"]);
  });

  it("falls back to the store description when the catalog does not know the product", () => {
    expect(planBenefits({ ...monthly, description: "90 minutes of live translation a month", minutes: null }, ios)[0])
      .toBe("90 minutes of live translation a month");
    expect(planBenefits({ ...pack, description: "30 minutes", minutes: null }, ios)).toEqual(["30 minutes", "Valid 3 months"]);
  });

  it("shows an introductory price honestly, with the renewal price", () => {
    const offer = { ...monthly, introPrice: { amount: 7.99, price: "$7.99" } };
    expect(planDisplayPrice(offer)).toEqual({ price: "$7.99", suffix: "first month" });
    expect(planBenefits(offer, ios)[0]).toBe("Then $9.99 a month");
    expect(planPurchaseLabel(offer)).toBe("Subscribe for $7.99 first month");
    expect(introDiscountPercent([offer, yearly])).toBe(20);
    expect(introDiscountPercent([monthly, yearly])).toBeNull();
    expect(introDiscountPercent([{ ...monthly, introPrice: { amount: 12, price: "$12" } }])).toBeNull();
  });

  it("labels prices and purchase buttons", () => {
    expect(planDisplayPrice(yearly)).toEqual({ price: "$99.99", suffix: "/ year" });
    expect(planDisplayPrice(pack)).toEqual({ price: "$7.99", suffix: null });
    expect(planPurchaseLabel(yearly)).toBe("Subscribe for $99.99 / year");
    expect(planPurchaseLabel(pack)).toBe("Buy for $7.99");
    expect(planAccessibilityLabel(pack, ios)).toBe("Trip Pass, $7.99, 60 minutes, Valid 3 months");
  });

  it("formats allowances in hours when they are whole", () => {
    expect(formatAllowance(60)).toBe("1 hour");
    expect(formatAllowance(120)).toBe("2 hours");
    expect(formatAllowance(90)).toBe("90 minutes");
  });
});
