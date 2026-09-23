import { Platform } from "react-native";
import Purchases, {
  LOG_LEVEL,
  PACKAGE_TYPE,
  PRODUCT_CATEGORY,
  type Price,
  type PurchasesOffering,
  type PurchasesPackage,
  type PurchasesStoreProduct,
  type SubscriptionOption,
} from "react-native-purchases";
import RevenueCatUI from "react-native-purchases-ui";

import { findBillingProduct } from "@murmur/protocol/billing/catalog";

import { getRevenueCatApiKeys, getRevenueCatOfferingId } from "../config";
import { LocalizedError } from "../../i18n/localizedError";
import {
  type MurmurPlan,
  type PlanIntroPrice,
  type PlanPeriod,
  planTier,
  planTitle,
  type PlanTerm,
} from "./planCatalog";

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
  return offering.availablePackages.map((storePackage) =>
    toMurmurPlan(storePackage, offering.identifier));
}

export async function purchaseMurmurPlan(
  planId: string,
  serverOfferingId: string | null,
): Promise<MurmurPlanPurchaseOutcome> {
  requireRevenueCat();
  const offering = await loadOffering(serverOfferingId);
  const selected = offering.availablePackages.find((candidate) => candidate.identifier === planId);
  if (!selected) {
    throw new LocalizedError("billing.planGone");
  }
  try {
    const playOption = selectedPlayOption(selected, offering.identifier);
    if (playOption) {
      await Purchases.purchaseSubscriptionOption(playOption);
    } else {
      await Purchases.purchasePackage(selected);
    }
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
    throw new LocalizedError("billing.productsMissing");
  }
  return offering;
}

const storeAppNameSuffix = /\s*\([^)]*\)\s*$/;

const subscriptionPeriods: Readonly<Partial<Record<string, PlanPeriod>>> = {
  P1M: "month",
  P1W: "week",
  P1Y: "year",
  P3M: "quarter",
  P6M: "halfYear",
};

function toMurmurPlan(storePackage: PurchasesPackage, offeringId: string): MurmurPlan {
  const { product } = storePackage;
  const playPrices = selectedPlayPrices(storePackage, offeringId);
  const term = planTerm(storePackage);
  const tier = planTier(storePackage.identifier, term);
  const storeTitle = product.title.replace(storeAppNameSuffix, "") || product.identifier;
  return {
    description: product.description,
    id: storePackage.identifier,
    introPrice: playPrices ? playPrices.intro : appleIntroPrice(product),
    minutes: catalogMinutes(product.identifier),
    period: planPeriod(term, product.subscriptionPeriod),
    price: playPrices?.full.formatted ?? product.priceString,
    priceAmount: playPrices ? playPrices.full.amountMicros / 1_000_000 : product.price,
    pricePerMonth: term === "yearly" ? product.pricePerMonthString : null,
    term,
    tier,
    title: planTitle(storePackage.identifier, tier, storeTitle),
  };
}

// The App Store carries the personal offer as an introductory price on the `.offer` products.
function appleIntroPrice(product: PurchasesStoreProduct): PlanIntroPrice | null {
  return product.introPrice
    ? { amount: product.introPrice.price, price: product.introPrice.priceString }
    : null;
}

// Minutes come from the shared billing catalog, matched by store product id.
function catalogMinutes(storeProductId: string): number | null {
  const product = findBillingProduct(Platform.OS === "ios" ? "apple" : "google", storeProductId);
  return product ? Math.round(product.grantMs / 60_000) : null;
}

// Google Play carries the personal offer as the intro phase of the `personal-20` option.
function selectedPlayPrices(
  storePackage: PurchasesPackage,
  offeringId: string,
): { full: Price; intro: PlanIntroPrice | null } | null {
  const option = selectedPlayOption(storePackage, offeringId);
  if (!option) {
    return null;
  }
  const full = option.fullPricePhase?.price ?? basePlayOption(storePackage.product)?.fullPricePhase?.price;
  if (!full) {
    throw new LocalizedError("billing.storePriceMissing");
  }
  if (!personalPlayOffer(offeringId, storePackage.identifier)) {
    return { full, intro: null };
  }
  const intro = option.introPhase?.price;
  if (!intro) {
    throw new LocalizedError("billing.offerPriceMissing");
  }
  return { full, intro: { amount: intro.amountMicros / 1_000_000, price: intro.formatted } };
}

function planPeriod(term: PlanTerm, subscriptionPeriod: string | null): PlanPeriod | null {
  if (term === "pack") {
    return null;
  }
  return subscriptionPeriods[subscriptionPeriod ?? ""] ??
    (term === "yearly" ? "year" : "month");
}

function selectedPlayOption(
  storePackage: PurchasesPackage,
  offeringId: string,
): SubscriptionOption | null {
  if (Platform.OS !== "android" ||
    storePackage.product.productCategory !== PRODUCT_CATEGORY.SUBSCRIPTION) {
    return null;
  }
  const { product } = storePackage;
  const base = basePlayOption(product);
  if (!base) {
    throw new LocalizedError("billing.basePlanMissing");
  }
  if (!personalPlayOffer(offeringId, storePackage.identifier)) {
    return base;
  }
  const offer = product.subscriptionOptions?.find((option) =>
    option.storeProductId === product.identifier && option.id === `${base.id}:personal-20`);
  if (!offer) {
    throw new LocalizedError("billing.personalOfferMissing");
  }
  return offer;
}

function basePlayOption(product: PurchasesStoreProduct): SubscriptionOption | null {
  const listedBase = product.subscriptionOptions?.find((option) =>
    option.isBasePlan && option.storeProductId === product.identifier);
  if (listedBase) {
    return listedBase;
  }
  return product.defaultOption?.isBasePlan ? product.defaultOption : null;
}

function personalPlayOffer(offeringId: string, packageId: string): boolean {
  return (offeringId === "personal_offer" || offeringId === "lite_personal_offer") &&
    (packageId === "$rc_monthly" || packageId === "$rc_annual");
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
    throw new LocalizedError("billing.notConfigured");
  }
}
