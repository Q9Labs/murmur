import { beforeEach, describe, expect, it, vi } from "vitest";

const store = vi.hoisted(() => ({
  configure: vi.fn(),
  getOfferings: vi.fn(),
  logIn: vi.fn(),
  presentCustomerCenter: vi.fn(),
  purchasePackage: vi.fn(),
  restorePurchases: vi.fn(),
}));

vi.mock("../config", () => ({
  getRevenueCatApiKeys: () => ({ ios: "apple-public-key" }),
  getRevenueCatOfferingId: () => "sandbox",
}));
vi.mock("react-native", () => ({
  Platform: {
    select: (options: { ios?: string }) => options.ios,
  },
}));
vi.mock("react-native-purchases", () => ({
  default: {
    configure: store.configure,
    getOfferings: store.getOfferings,
    logIn: store.logIn,
    purchasePackage: store.purchasePackage,
    restorePurchases: store.restorePurchases,
    setLogLevel: vi.fn(),
  },
  LOG_LEVEL: { DEBUG: "DEBUG" },
  PACKAGE_TYPE: { ANNUAL: "ANNUAL", CUSTOM: "CUSTOM", MONTHLY: "MONTHLY" },
  PRODUCT_CATEGORY: { NON_SUBSCRIPTION: "NON_SUBSCRIPTION", SUBSCRIPTION: "SUBSCRIPTION" },
}));
vi.mock("react-native-purchases-ui", () => ({
  default: {
    presentCustomerCenter: store.presentCustomerCenter,
  },
}));

import {
  configureRevenueCat,
  loadMurmurPlans,
  presentMurmurCustomerCenter,
  purchaseMurmurPlan,
  restoreMurmurPurchases,
} from "./revenueCat";

function storePackage(params: {
  amount: number;
  category: "NON_SUBSCRIPTION" | "SUBSCRIPTION";
  description: string;
  identifier: string;
  packageType?: string;
  period?: string;
  perMonth?: string;
  price: string;
  title: string;
}) {
  return {
    identifier: params.identifier,
    packageType: params.packageType ?? "CUSTOM",
    product: {
      description: params.description,
      identifier: `product.${params.identifier}`,
      price: params.amount,
      pricePerMonthString: params.perMonth ?? null,
      priceString: params.price,
      productCategory: params.category,
      subscriptionPeriod: params.period ?? null,
      title: params.title,
    },
  };
}

const launchPackages = [
  storePackage({
    amount: 7.99,
    category: "NON_SUBSCRIPTION",
    description: "60 minutes of live translation",
    identifier: "pack_60",
    price: "$7.99",
    title: "Trip Pass (Murmur - Live Translate)",
  }),
  storePackage({
    amount: 9.99,
    category: "SUBSCRIPTION",
    description: "2 hours of live translation a month",
    identifier: "$rc_monthly",
    packageType: "MONTHLY",
    period: "P1M",
    perMonth: "$9.99",
    price: "$9.99",
    title: "Murmur Pro",
  }),
  storePackage({
    amount: 99.99,
    category: "SUBSCRIPTION",
    description: "2 hours of live translation a month",
    identifier: "$rc_annual",
    packageType: "ANNUAL",
    perMonth: "$8.33",
    price: "$99.99",
    title: "Murmur Pro Annual",
  }),
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("__DEV__", false);
  store.getOfferings.mockResolvedValue({
    all: {
      launch: { availablePackages: launchPackages, identifier: "launch" },
      sandbox: { availablePackages: [], identifier: "sandbox" },
    },
    current: { identifier: "default" },
  });
  store.logIn.mockResolvedValue(undefined);
  store.presentCustomerCenter.mockResolvedValue(undefined);
  store.restorePurchases.mockResolvedValue(undefined);
});

describe("RevenueCat mobile adapter", () => {
  it("keeps purchases attached to the server customer identity", async () => {
    await expect(configureRevenueCat("customer-1")).resolves.toBe(true);
    await expect(configureRevenueCat("customer-2")).resolves.toBe(true);

    expect(store.configure).toHaveBeenCalledWith({
      apiKey: "apple-public-key",
      appUserID: "customer-1",
    });
    expect(store.logIn).toHaveBeenCalledWith("customer-2");
  });

  it("opens the restore flow and customer center", async () => {
    await configureRevenueCat("customer-2");
    await restoreMurmurPurchases();
    await presentMurmurCustomerCenter();

    expect(store.restorePurchases).toHaveBeenCalledOnce();
    expect(store.presentCustomerCenter).toHaveBeenCalledOnce();
  });

  it("maps the server-chosen offering to monthly, yearly and pack plans with store prices", async () => {
    await configureRevenueCat("customer-2");

    await expect(loadMurmurPlans("launch")).resolves.toEqual([
      {
        description: "60 minutes of live translation",
        id: "pack_60",
        periodLabel: null,
        price: "$7.99",
        priceAmount: 7.99,
        pricePerMonth: null,
        term: "pack",
        title: "Trip Pass",
      },
      {
        description: "2 hours of live translation a month",
        id: "$rc_monthly",
        periodLabel: "month",
        price: "$9.99",
        priceAmount: 9.99,
        pricePerMonth: null,
        term: "monthly",
        title: "Murmur Pro",
      },
      {
        description: "2 hours of live translation a month",
        id: "$rc_annual",
        periodLabel: "year",
        price: "$99.99",
        priceAmount: 99.99,
        pricePerMonth: "$8.33",
        term: "yearly",
        title: "Murmur Pro Annual",
      },
    ]);
  });

  it("buys the chosen package and reports a store cancellation separately", async () => {
    await configureRevenueCat("customer-2");
    store.purchasePackage.mockResolvedValueOnce({});
    store.purchasePackage.mockRejectedValueOnce({ userCancelled: true });
    store.purchasePackage.mockRejectedValueOnce(new Error("store down"));

    await expect(purchaseMurmurPlan("pack_60", "launch")).resolves.toBe("purchased");
    await expect(purchaseMurmurPlan("pack_60", "launch")).resolves.toBe("cancelled");
    await expect(purchaseMurmurPlan("pack_60", "launch")).rejects.toThrow("store down");
    await expect(purchaseMurmurPlan("missing", "launch")).rejects.toThrow(
      "That plan is no longer available from the store.",
    );
    expect(store.purchasePackage).toHaveBeenCalledWith(launchPackages[0]);
  });
});
