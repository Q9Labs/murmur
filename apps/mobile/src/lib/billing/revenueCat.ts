import { Platform } from "react-native";
import Purchases, { LOG_LEVEL } from "react-native-purchases";
import RevenueCatUI from "react-native-purchases-ui";

import { getRevenueCatApiKeys } from "../config";

let configuredApiKey: string | null = null;
let configuredCustomerId: string | null = null;

export async function configureRevenueCat(customerId: string): Promise<boolean> {
  const apiKey = revenueCatApiKey();
  if (!apiKey) {
    return false;
  }

  if (!configuredApiKey) {
    if (__DEV__) {
      Purchases.setLogLevel(LOG_LEVEL.DEBUG);
    }
    Purchases.configure({ apiKey, appUserID: customerId });
    configuredApiKey = apiKey;
    configuredCustomerId = customerId;
    return true;
  }
  if (configuredApiKey !== apiKey) {
    throw new Error("RevenueCat was configured with a different store key.");
  }
  if (configuredCustomerId !== customerId) {
    await Purchases.logIn(customerId);
    configuredCustomerId = customerId;
  }
  return true;
}

export async function presentMurmurPaywall(): Promise<void> {
  requireRevenueCat();
  const offerings = await Purchases.getOfferings();
  if (!offerings.current) {
    throw new Error("Murmur products are not available from the store yet.");
  }
  await RevenueCatUI.presentPaywall({
    displayCloseButton: true,
    offering: offerings.current,
  });
}

export async function restoreMurmurPurchases(): Promise<void> {
  requireRevenueCat();
  await Purchases.restorePurchases();
}

export async function presentMurmurCustomerCenter(): Promise<void> {
  requireRevenueCat();
  await RevenueCatUI.presentCustomerCenter();
}

function revenueCatApiKey(): string | null {
  return Platform.select(getRevenueCatApiKeys()) ?? null;
}

function requireRevenueCat(): void {
  if (!configuredApiKey) {
    throw new Error("Purchases are not configured in this build.");
  }
}
