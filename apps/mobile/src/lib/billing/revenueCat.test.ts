import { beforeEach, describe, expect, it, vi } from "vitest";

const store = vi.hoisted(() => ({
  configure: vi.fn(),
  getOfferings: vi.fn(),
  logIn: vi.fn(),
  presentCustomerCenter: vi.fn(),
  presentPaywall: vi.fn(),
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
  PRODUCT_CATEGORY: { NON_SUBSCRIPTION: "NON_SUBSCRIPTION", SUBSCRIPTION: "SUBSCRIPTION" },
}));
vi.mock("react-native-purchases-ui", () => ({
  default: {
    presentCustomerCenter: store.presentCustomerCenter,
    presentPaywall: store.presentPaywall,
  },
  PAYWALL_RESULT: {
    CANCELLED: "CANCELLED",
    ERROR: "ERROR",
    NOT_PRESENTED: "NOT_PRESENTED",
    PURCHASED: "PURCHASED",
    RESTORED: "RESTORED",
  },
}));

import {
  configureRevenueCat,
  loadMurmurPlans,
  presentMurmurCustomerCenter,
  presentMurmurPaywall,
  purchaseMurmurPlan,
  restoreMurmurPurchases,
} from "./revenueCat";

function storePackage(params: {
  category: "NON_SUBSCRIPTION" | "SUBSCRIPTION";
  identifier: string;
  period?: string;
  price: string;
  title: string;
}) {
  return {
    identifier: params.identifier,
    product: {
      identifier: `product.${params.identifier}`,
      priceString: params.price,
      productCategory: params.category,
      subscriptionPeriod: params.period ?? null,
      title: params.title,
    },
  };
}

const launchPackages = [
  storePackage({ category: "NON_SUBSCRIPTION", identifier: "pack_60", price: "$7.99", title: "1 hour (Murmur - Live Translate)" }),
  storePackage({ category: "SUBSCRIPTION", identifier: "$rc_monthly", period: "P1M", price: "$9.99", title: "Murmur Pro" }),
  storePackage({ category: "SUBSCRIPTION", identifier: "$rc_annual", period: "P1Y", price: "$99.99", title: "Murmur Pro Annual" }),
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
  store.presentPaywall.mockResolvedValue("PURCHASED");
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

  it("opens the configured paywall, restore flow, and customer center", async () => {
    await configureRevenueCat("customer-2");
    await expect(presentMurmurPaywall()).resolves.toBe("purchased");
    await restoreMurmurPurchases();
    await presentMurmurCustomerCenter();

    expect(store.presentPaywall).toHaveBeenCalledWith({
      displayCloseButton: true,
      offering: { availablePackages: [], identifier: "sandbox" },
    });
    expect(store.restorePurchases).toHaveBeenCalledOnce();
    expect(store.presentCustomerCenter).toHaveBeenCalledOnce();
  });

  it("lists Pro plans before top-ups with store prices from the server-chosen offering", async () => {
    await configureRevenueCat("customer-2");

    await expect(loadMurmurPlans("launch")).resolves.toEqual([
      { id: "$rc_monthly", kind: "pro", price: "$9.99 / month", title: "Murmur Pro" },
      { id: "$rc_annual", kind: "pro", price: "$99.99 / year", title: "Murmur Pro Annual" },
      { id: "pack_60", kind: "top_up", price: "$7.99", title: "1 hour" },
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
