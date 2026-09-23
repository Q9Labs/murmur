import { describe, expect, it } from "vitest";

import {
  defaultPlanTerm,
  type MurmurPlan,
  planAccessibilityLabel,
  planBenefits,
  planPriceSuffix,
  planPurchaseLabel,
  planTabs,
  yearlySaving,
} from "./planCatalog";

function plan(overrides: Partial<MurmurPlan> & Pick<MurmurPlan, "id" | "term">): MurmurPlan {
  return {
    description: "",
    periodLabel: null,
    price: "$0",
    priceAmount: 0,
    pricePerMonth: null,
    title: overrides.id,
    ...overrides,
  };
}

const monthly = plan({
  description: "2 hours of live translation a month",
  id: "monthly",
  periodLabel: "month",
  price: "$9.99",
  priceAmount: 9.99,
  term: "monthly",
});
const yearly = plan({
  description: "2 hours of live translation a month",
  id: "yearly",
  periodLabel: "year",
  price: "$99.99",
  priceAmount: 99.99,
  pricePerMonth: "$8.33",
  term: "yearly",
});
const pack = plan({
  description: "60 minutes of live translation",
  id: "trip",
  price: "$7.99",
  priceAmount: 7.99,
  term: "pack",
});

describe("plan catalog", () => {
  it("orders tabs Monthly, Yearly, Credit packs and hides empty ones", () => {
    expect(planTabs([pack, yearly, monthly]).map((tab) => tab.label)).toEqual([
      "Monthly",
      "Yearly",
      "Credit packs",
    ]);
    expect(planTabs([pack]).map((tab) => tab.term)).toEqual(["pack"]);
  });

  it("pre-selects Yearly when the offering has it", () => {
    expect(defaultPlanTerm(planTabs([monthly, yearly, pack]))).toBe("yearly");
    expect(defaultPlanTerm(planTabs([monthly, pack]))).toBe("monthly");
    expect(defaultPlanTerm([])).toBeNull();
  });

  it("never claims a saving of less than one whole month", () => {
    expect(yearlySaving({ ...yearly, priceAmount: 115 }, [monthly, yearly])).toBeNull();
    expect(planBenefits({ ...yearly, priceAmount: 115, pricePerMonth: null }, [monthly, yearly])).toEqual([
      "2 hours of live translation a month",
    ]);
    expect(planAccessibilityLabel({ ...yearly, priceAmount: 115 }, [monthly, yearly])).toBe("yearly, $99.99 / year");
  });

  it("computes the yearly saving from store prices, rounding down", () => {
    expect(yearlySaving(yearly, [monthly, yearly])).toEqual({ monthsFree: 1, percent: 16 });
    expect(yearlySaving({ ...yearly, priceAmount: 99.9 }, [monthly, yearly])).toEqual({ monthsFree: 2, percent: 16 });
    expect(yearlySaving(yearly, [yearly])).toBeNull();
    expect(yearlySaving({ ...yearly, priceAmount: 130 }, [monthly, yearly])).toBeNull();
    expect(yearlySaving(monthly, [monthly, yearly])).toBeNull();
  });

  it("writes short benefit lines per plan type", () => {
    expect(planBenefits(monthly, [monthly])).toEqual(["2 hours of live translation a month"]);
    expect(planBenefits(yearly, [monthly, yearly])).toEqual([
      "2 hours of live translation a month",
      "$8.33 a month, 1 month free",
    ]);
    expect(planBenefits({ ...yearly, pricePerMonth: null }, [monthly, yearly])).toEqual([
      "2 hours of live translation a month",
      "1 month free",
    ]);
    expect(planBenefits({ ...yearly, pricePerMonth: null }, [yearly])).toEqual([
      "2 hours of live translation a month",
    ]);
    expect(planBenefits(pack, [pack])).toEqual(["60 minutes of live translation", "Never expires"]);
  });

  it("labels prices and purchase buttons", () => {
    expect(planPriceSuffix(yearly)).toBe("/ year");
    expect(planPriceSuffix(pack)).toBeNull();
    expect(planPurchaseLabel(yearly)).toBe("Subscribe for $99.99 / year");
    expect(planPurchaseLabel(pack)).toBe("Buy for $7.99");
    expect(planAccessibilityLabel(yearly, [monthly, yearly])).toBe(
      "yearly, $99.99 / year, Save 16% against monthly",
    );
    expect(planAccessibilityLabel(pack, [pack])).toBe("trip, $7.99");
  });
});
