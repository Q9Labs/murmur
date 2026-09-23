import { Platform } from "react-native";
import Purchases, {
  LOG_LEVEL,
  PACKAGE_TYPE,
  PRODUCT_CATEGORY,
  type PurchasesOffering,
  type PurchasesPackage,
} from "react-native-purchases";
import RevenueCatUI from "react-native-purchases-ui";

import { getRevenueCatApiKeys, getRevenueCatOfferingId } from "../config";
import type { MurmurPlan, PlanTerm } from "./planCatalog";

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

export type MurmurPlanPurchaseOutcome = "cancelled" | "purchased";

export async function loadMurmurPlans(serverOfferingId: string | null): Promise<MurmurPlan[]> {
  requireRevenueCat();
  const offering = await loadOffering(serverOfferingId);
  return offering.availablePackages.map(toMurmurPlan);
}

export async function purchaseMurmurPlan(
  planId: string,
  serverOfferingId: string | null,
): Promise<MurmurPlanPurchaseOutcome> {
  requireRevenueCat();
  const offering = await loadOffering(serverOfferingId);
  const selected = offering.availablePackages.find((candidate) => candidate.identifier === planId);
  if (!selected) {
    throw new Error("That plan is no longer available from the store.");
  }
  try {
    await Purchases.purchasePackage(selected);
    return "purchased";
  } catch (failure) {
    if (isUserCancellation(failure)) {
      return "cancelled";
    }
    throw failure;
  }
}

export async function restoreMurmurPurchases(): Promise<void> {
  requireRevenueCat();
  await Purchases.restorePurchases();
}

export async function presentMurmurCustomerCenter(): Promise<void> {
  requireRevenueCat();
  await RevenueCatUI.presentCustomerCenter();
}

async function loadOffering(serverOfferingId: string | null): Promise<PurchasesOffering> {
  const offerings = await Purchases.getOfferings();
  const offeringId = serverOfferingId ?? getRevenueCatOfferingId();
  const offering = offeringId ? offerings.all[offeringId] : offerings.current;
  if (!offering) {
    throw new Error("Murmur products are not available from the store yet.");
  }
  return offering;
}

const storeAppNameSuffix = /\s*\([^)]*\)\s*$/;

const subscriptionPeriodLabels: Readonly<Partial<Record<string, string>>> = {
  P1M: "month",
  P1W: "week",
  P1Y: "year",
  P3M: "3 months",
  P6M: "6 months",
};

function toMurmurPlan(storePackage: PurchasesPackage): MurmurPlan {
  const { product } = storePackage;
  const term = planTerm(storePackage);
  const periodLabel = term === "pack"
    ? null
    : subscriptionPeriodLabels[product.subscriptionPeriod ?? ""] ??
      (term === "yearly" ? "year" : "month");
  return {
    description: product.description,
    id: storePackage.identifier,
    periodLabel,
    price: product.priceString,
    priceAmount: product.price,
    pricePerMonth: term === "yearly" ? product.pricePerMonthString : null,
    term,
    title: product.title.replace(storeAppNameSuffix, "") || product.identifier,
  };
}

function planTerm(storePackage: PurchasesPackage): PlanTerm {
  if (storePackage.product.productCategory !== PRODUCT_CATEGORY.SUBSCRIPTION) {
    return "pack";
  }
  const isYearly = storePackage.packageType === PACKAGE_TYPE.ANNUAL ||
    storePackage.product.subscriptionPeriod === "P1Y";
  return isYearly ? "yearly" : "monthly";
}

function isUserCancellation(failure: unknown): boolean {
  return typeof failure === "object" &&
    failure !== null &&
    Reflect.get(failure, "userCancelled") === true;
}

function revenueCatApiKey(): string | null {
  return Platform.select(getRevenueCatApiKeys()) ?? null;
}

function requireRevenueCat(): void {
  if (!configuredApiKey) {
    throw new Error("Purchases are not configured in this build.");
  }
}
