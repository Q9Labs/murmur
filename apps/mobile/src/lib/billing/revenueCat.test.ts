import { beforeEach, describe, expect, it, vi } from "vitest";

const store = vi.hoisted(() => ({
  configure: vi.fn(),
  getOfferings: vi.fn(),
  logIn: vi.fn(),
  presentCustomerCenter: vi.fn(),
  purchasePackage: vi.fn(),
  purchaseSubscriptionOption: vi.fn(),
  restorePurchases: vi.fn(),
}));
const platform = vi.hoisted(() => ({ os: "ios" }));

vi.mock("../config", () => ({
  getRevenueCatApiKeys: () => ({ android: "apple-public-key", ios: "apple-public-key" }),
  getRevenueCatOfferingId: () => "sandbox",
}));
vi.mock("react-native", () => ({
  Platform: {
    get OS() { return platform.os; },
    select: (options: { android?: string; ios?: string }) =>
      platform.os === "android" ? options.android : options.ios,
  },
}));
vi.mock("react-native-purchases", () => ({
  default: {
    configure: store.configure,
    getOfferings: store.getOfferings,
    logIn: store.logIn,
    purchasePackage: store.purchasePackage,
    purchaseSubscriptionOption: store.purchaseSubscriptionOption,
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
  intro?: { price: number; priceString: string };
  packageType?: string;
  period?: string;
  perMonth?: string;
  price: string;
  productId?: string;
  title: string;
}) {
  return {
    identifier: params.identifier,
    packageType: params.packageType ?? "CUSTOM",
    product: {
      description: params.description,
      identifier: params.productId ?? `product.${params.identifier}`,
      introPrice: params.intro ?? null,
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
    identifier: "trip_pass_60",
    price: "$7.99",
    productId: "com.q9labsai.murmur.credits.60",
    title: "Trip Pass, 60 minutes (Murmur - Live Translate)",
  }),
  storePackage({
    amount: 9.99,
    category: "SUBSCRIPTION",
    description: "2 hours of live translation a month",
    identifier: "$rc_monthly",
    intro: { price: 7.99, priceString: "$7.99" },
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
  platform.os = "ios";
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
      },
      {
        description: "2 hours of live translation a month",
        id: "$rc_monthly",
        introPrice: { amount: 7.99, price: "$7.99" },
        minutes: null,
        periodLabel: "month",
        price: "$9.99",
        priceAmount: 9.99,
        pricePerMonth: null,
        term: "monthly",
        tier: "pro",
        title: "Pro",
      },
      {
        description: "2 hours of live translation a month",
        id: "$rc_annual",
        introPrice: null,
        minutes: null,
        periodLabel: "year",
        price: "$99.99",
        priceAmount: 99.99,
        pricePerMonth: "$8.33",
        term: "yearly",
        tier: "pro",
        title: "Pro",
      },
    ]);
  });

  it("names live Pro Max packages by tier", async () => {
    await configureRevenueCat("customer-2");
    const proMaxPackages = [
      storePackage({
        amount: 29.99, category: "SUBSCRIPTION", description: "400 minutes a month",
        identifier: "promax_monthly", packageType: "MONTHLY", period: "P1M",
        price: "$29.99", title: "Murmur Pro Max",
      }),
      storePackage({
        amount: 299.99, category: "SUBSCRIPTION", description: "400 minutes a month",
        identifier: "promax_annual", packageType: "ANNUAL", period: "P1Y",
        price: "$299.99", title: "Murmur Pro Max Annual",
      }),
    ];
    store.getOfferings.mockResolvedValue({
      all: { max: { availablePackages: [...launchPackages, ...proMaxPackages], identifier: "max" } },
      current: null,
    });

    const plans = await loadMurmurPlans("max");
    const annual = plans.find((plan) => plan.id === "promax_annual");
    expect(annual?.tier).toBe("pro_max");
    expect(annual?.title).toBe("Pro Max");
  });

  it("buys the chosen package and reports a store cancellation separately", async () => {
    await configureRevenueCat("customer-2");
    store.purchasePackage.mockResolvedValueOnce({});
    store.purchasePackage.mockRejectedValueOnce({ userCancelled: true });
    store.purchasePackage.mockRejectedValueOnce(new Error("store down"));

    await expect(purchaseMurmurPlan("trip_pass_60", "launch")).resolves.toBe("purchased");
    await expect(purchaseMurmurPlan("trip_pass_60", "launch")).resolves.toBe("cancelled");
    await expect(purchaseMurmurPlan("trip_pass_60", "launch")).rejects.toThrow("store down");
    await expect(purchaseMurmurPlan("missing", "launch")).rejects.toThrow(
      "That plan is no longer available from the store.",
    );
    expect(store.purchasePackage).toHaveBeenCalledWith(launchPackages[0]);
  });

  it("buys Play base plans normally and personal-20 only from a personal offering", async () => {
    platform.os = "android";
    await configureRevenueCat("customer-2");
    const base = {
      fullPricePhase: { price: { amountMicros: 699_000_000, formatted: "₹699" } },
      id: "monthly",
      isBasePlan: true,
      storeProductId: "murmur_pro_lite:monthly",
    };
    const offer = {
      id: "monthly:personal-20",
      introPhase: { price: { amountMicros: 549_000_000, formatted: "₹549" } },
      isBasePlan: false,
      storeProductId: "murmur_pro_lite:monthly",
    };
    const monthly = storePackage({
      amount: 549,
      category: "SUBSCRIPTION",
      description: "90 minutes a month",
      identifier: "$rc_monthly",
      period: "P1M",
      price: "₹549",
      title: "Murmur Pro",
    });
    monthly.product.identifier = "murmur_pro_lite:monthly";
    const playPackage = {
      ...monthly,
      product: { ...monthly.product, defaultOption: offer, subscriptionOptions: [base, offer] },
    };
    store.getOfferings.mockResolvedValue({
      all: {
        lite: { availablePackages: [playPackage], identifier: "lite" },
        lite_personal_offer: { availablePackages: [playPackage], identifier: "lite_personal_offer" },
      },
      current: null,
    });
    store.purchaseSubscriptionOption.mockResolvedValue({});

    await expect(loadMurmurPlans("lite")).resolves.toMatchObject([{ price: "₹699", priceAmount: 699 }]);
    await expect(loadMurmurPlans("lite_personal_offer"))
      .resolves.toMatchObject([{ introPrice: { amount: 549, price: "₹549" }, price: "₹699", priceAmount: 699 }]);
    await purchaseMurmurPlan("$rc_monthly", "lite");
    await purchaseMurmurPlan("$rc_monthly", "lite_personal_offer");
    expect(store.purchaseSubscriptionOption).toHaveBeenNthCalledWith(1, base);
    expect(store.purchaseSubscriptionOption).toHaveBeenNthCalledWith(2, offer);
    expect(store.purchasePackage).not.toHaveBeenCalled();
  });
});
