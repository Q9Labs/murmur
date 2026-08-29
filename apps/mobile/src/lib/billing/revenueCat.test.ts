import { beforeEach, describe, expect, it, vi } from "vitest";

const store = vi.hoisted(() => ({
  configure: vi.fn(),
  getOfferings: vi.fn(),
  logIn: vi.fn(),
  presentCustomerCenter: vi.fn(),
  presentPaywall: vi.fn(),
  restorePurchases: vi.fn(),
}));

vi.mock("../config", () => ({
  getRevenueCatApiKeys: () => ({ ios: "apple-public-key" }),
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
    restorePurchases: store.restorePurchases,
    setLogLevel: vi.fn(),
  },
  LOG_LEVEL: { DEBUG: "DEBUG" },
}));
vi.mock("react-native-purchases-ui", () => ({
  default: {
    presentCustomerCenter: store.presentCustomerCenter,
    presentPaywall: store.presentPaywall,
  },
}));

import {
  configureRevenueCat,
  presentMurmurCustomerCenter,
  presentMurmurPaywall,
  restoreMurmurPurchases,
} from "./revenueCat";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("__DEV__", false);
  store.getOfferings.mockResolvedValue({ current: { identifier: "default" } });
  store.logIn.mockResolvedValue(undefined);
  store.presentCustomerCenter.mockResolvedValue(undefined);
  store.presentPaywall.mockResolvedValue(undefined);
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
    await presentMurmurPaywall();
    await restoreMurmurPurchases();
    await presentMurmurCustomerCenter();

    expect(store.presentPaywall).toHaveBeenCalledWith({
      displayCloseButton: true,
      offering: { identifier: "default" },
    });
    expect(store.restorePurchases).toHaveBeenCalledOnce();
    expect(store.presentCustomerCenter).toHaveBeenCalledOnce();
  });
});
