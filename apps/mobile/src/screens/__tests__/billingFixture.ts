import { vi } from "vitest";

import type { MurmurBillingContext } from "../../lib/billing/context";
import type { MurmurCustomer } from "../../lib/billing/customerResponse";
import type { MurmurPlan } from "../../lib/billing/planCatalog";

export const fixtureCustomer: MurmurCustomer = {
  allowanceMs: 300_000,
  availableMs: 0,
  creditMs: 0,
  customerId: "customer-1",
  earliestExpiryAtMs: null,
  fulfillmentEnabled: true,
  isRegistered: false,
  negativeMs: 0,
  plan: "free",
  purchasesEnabled: true,
  revenueCatCustomerId: "customer-1",
};

export function fixtureBilling(overrides: Partial<MurmurCustomer> = {}): MurmurBillingContext {
  return {
    busy: false,
    config: { enabledLanguages: null, lowBalanceThresholdMinutes: 15, paywallOfferingId: null, personalOfferExpiresAtMs: null },
    configLoaded: true,
    customer: { ...fixtureCustomer, ...overrides },
    deleteAccount: vi.fn(async () => undefined),
    error: null,
    initialized: true,
    loadPlans: vi.fn(async () => []),
    loadPlansSilently: vi.fn(async () => []),
    manageSubscription: vi.fn(async () => undefined),
    notice: null,
    purchasePlan: vi.fn(async () => true),
    purchasesAvailable: true,
    refresh: vi.fn(async () => undefined),
    restorePurchases: vi.fn(async () => undefined),
    sendSignInCode: vi.fn(async () => undefined),
    switchAccount: vi.fn(async () => undefined),
    syncing: false,
    verifySignInCode: vi.fn(async () => undefined),
  };
}

export const fixtureMonthly: MurmurPlan = {
  description: "2 hours of live translation a month",
  id: "$rc_monthly",
  introPrice: null,
  minutes: 120,
  periodLabel: "month",
  price: "$9.99",
  priceAmount: 9.99,
  pricePerMonth: null,
  term: "monthly",
  tier: "pro",
  title: "Pro",
};

export const fixtureMaxMonthly: MurmurPlan = {
  ...fixtureMonthly,
  description: "400 minutes of live translation a month",
  id: "promax_monthly",
  minutes: 400,
  price: "$29.99",
  priceAmount: 29.99,
  tier: "pro_max",
  title: "Pro Max",
};

export const fixtureYearly: MurmurPlan = {
  description: "2 hours of live translation a month",
  id: "$rc_annual",
  introPrice: null,
  minutes: 120,
  periodLabel: "year",
  price: "$99.99",
  priceAmount: 99.99,
  pricePerMonth: "$8.33",
  term: "yearly",
  tier: "pro",
  title: "Pro",
};

export const fixturePack: MurmurPlan = {
  description: "60 minutes of live translation",
  id: "trip_pass_60",
  introPrice: null,
  minutes: 60,
  periodLabel: null,
  price: "$7.99",
  priceAmount: 7.99,
  pricePerMonth: null,
  term: "pack",
  tier: null,
  title: "Trip Pass",
};

export const fixturePlans: MurmurPlan[] = [fixtureMonthly, fixtureMaxMonthly, fixtureYearly, fixturePack];
