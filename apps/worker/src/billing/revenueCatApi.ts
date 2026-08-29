import type { Env } from "../env";
import type { StoreProvider } from "./catalog";
import type { RevenueCatEvent } from "./revenueCatEvent";

const productIdentifierCache = new Map<string, string>();

export type RevenueCatSubscription = {
  currentPeriodStartsAtMs: number;
  episodeId: string;
  environment: RevenueCatEvent["environment"];
  givesAccess: boolean;
  originalPurchasedAtMs: number;
  paidThroughMs: number | null;
  productId: string;
  provider: StoreProvider;
  status: string;
  storeSubscriptionId: string;
};

export type RevenueCatPurchase = {
  environment: RevenueCatEvent["environment"];
  productId: string;
  provider: StoreProvider;
  purchaseId: string;
  purchasedAtMs: number;
  status: string;
  storeTransactionId: string;
};

export type RevenueCatCustomerState = {
  purchases: RevenueCatPurchase[];
  subscriptions: RevenueCatSubscription[];
};

export type RevenueCatVerifiedResource = RevenueCatPurchase | RevenueCatSubscription;

export async function verifyRevenueCatEvent(params: {
  env: Env;
  event: RevenueCatEvent;
}): Promise<RevenueCatVerifiedResource | null> {
  const state = await fetchRevenueCatCustomerState({
    appUserId: params.event.appUserId,
    env: params.env,
  });
  if (!params.event.provider || !params.event.productId) {
    return null;
  }
  const subscription = state.subscriptions.find((candidate) =>
    candidate.environment === params.event.environment &&
    candidate.productId === params.event.productId &&
    candidate.provider === params.event.provider &&
    candidate.storeSubscriptionId === params.event.originalTransactionId
  );
  if (subscription) {
    return subscription;
  }
  return state.purchases.find((candidate) =>
    candidate.environment === params.event.environment &&
    candidate.productId === params.event.productId &&
    candidate.provider === params.event.provider &&
    candidate.storeTransactionId === params.event.transactionId
  ) ?? null;
}

export async function fetchRevenueCatCustomerState(params: {
  appUserId: string;
  env: Env;
}): Promise<RevenueCatCustomerState> {
  const projectId = requiredConfiguration(params.env.REVENUECAT_PROJECT_ID, "project ID");
  const customerPath = `/v2/projects/${encodeURIComponent(projectId)}/customers/${encodeURIComponent(params.appUserId)}`;
  const [subscriptionItems, purchaseItems] = await Promise.all([
    fetchRevenueCatList(params.env, projectId, `${customerPath}/subscriptions?limit=100`),
    fetchRevenueCatList(params.env, projectId, `${customerPath}/purchases?limit=100`),
  ]);
  const productIds = new Set<string>();
  for (const item of [...subscriptionItems, ...purchaseItems]) {
    const productId = stringField(item, "product_id");
    if (productId) {
      productIds.add(productId);
    }
  }
  const productEntries = await Promise.all(
    [...productIds].map(async (productId) => {
      const cached = productIdentifierCache.get(productId);
      if (cached) {
        return { revenueCatProductId: productId, storeIdentifier: cached };
      }
      const product = await fetchRevenueCatObject(
        params.env,
        `/v2/projects/${encodeURIComponent(projectId)}/products/${encodeURIComponent(productId)}`,
      );
      const storeIdentifier = stringField(product, "store_identifier");
      if (storeIdentifier) {
        productIdentifierCache.set(productId, storeIdentifier);
      }
      return {
        revenueCatProductId: productId,
        storeIdentifier,
      };
    }),
  );
  const productIdentifiers = new Map<string, string>();
  for (const entry of productEntries) {
    if (entry.storeIdentifier) {
      productIdentifiers.set(entry.revenueCatProductId, entry.storeIdentifier);
    }
  }
  return decodeRevenueCatCustomerState({
    productIdentifiers,
    purchaseItems,
    subscriptionItems,
  });
}

export function decodeRevenueCatCustomerState(params: {
  productIdentifiers: ReadonlyMap<string, string>;
  purchaseItems: readonly object[];
  subscriptionItems: readonly object[];
}): RevenueCatCustomerState {
  const subscriptions = params.subscriptionItems
    .map((item) => decodeSubscription(item, params.productIdentifiers))
    .filter((item): item is RevenueCatSubscription => item !== null);
  const purchases = params.purchaseItems
    .map((item) => decodePurchase(item, params.productIdentifiers))
    .filter((item): item is RevenueCatPurchase => item !== null);
  return { purchases, subscriptions };
}

function decodeSubscription(
  item: object,
  productIdentifiers: ReadonlyMap<string, string>,
): RevenueCatSubscription | null {
  const storeResource = decodeStoreResource(item, productIdentifiers);
  const episodeId = stringField(item, "id");
  const storeSubscriptionId = identifierField(item, "store_subscription_identifier");
  const originalPurchasedAtMs = integerField(item, "starts_at");
  const currentPeriodStartsAtMs = integerField(item, "current_period_starts_at");
  const givesAccess = booleanField(item, "gives_access");
  const status = stringField(item, "status");
  if (!storeResource || !episodeId || !storeSubscriptionId ||
    originalPurchasedAtMs === null || currentPeriodStartsAtMs === null ||
    givesAccess === null || !status) {
    return null;
  }
  return {
    ...storeResource,
    currentPeriodStartsAtMs,
    episodeId,
    givesAccess,
    originalPurchasedAtMs,
    paidThroughMs: nullableIntegerField(item, "ends_at") ??
      nullableIntegerField(item, "current_period_ends_at"),
    status,
    storeSubscriptionId,
  };
}

function decodePurchase(
  item: object,
  productIdentifiers: ReadonlyMap<string, string>,
): RevenueCatPurchase | null {
  const storeResource = decodeStoreResource(item, productIdentifiers);
  const purchaseId = stringField(item, "id");
  const storeTransactionId = identifierField(item, "store_purchase_identifier");
  const purchasedAtMs = integerField(item, "purchased_at");
  const status = stringField(item, "status");
  if (!storeResource || !purchaseId || !storeTransactionId || purchasedAtMs === null || !status) {
    return null;
  }
  return {
    ...storeResource,
    purchaseId,
    purchasedAtMs,
    status,
    storeTransactionId,
  };
}

function decodeStoreResource(
  item: object,
  productIdentifiers: ReadonlyMap<string, string>,
): Pick<RevenueCatPurchase, "environment" | "productId" | "provider"> | null {
  const environment = environmentField(item);
  const provider = providerField(item);
  const revenueCatProductId = stringField(item, "product_id");
  const productId = revenueCatProductId
    ? productIdentifiers.get(revenueCatProductId) ?? null
    : null;
  return environment && provider && productId ? { environment, productId, provider } : null;
}

async function fetchRevenueCatList(
  env: Env,
  projectId: string,
  initialPath: string,
): Promise<object[]> {
  const items: object[] = [];
  let nextPath: string | null = initialPath;
  for (let page = 0; nextPath && page < 100; page += 1) {
    const payload = await fetchRevenueCatObject(env, nextPath);
    const pageItems = Reflect.get(payload, "items");
    if (!Array.isArray(pageItems)) {
      throw new Error("RevenueCat list response has no items");
    }
    for (const item of pageItems) {
      if (typeof item === "object" && item !== null) {
        items.push(item);
      }
    }
    nextPath = nextPagePath(payload, projectId);
  }
  if (nextPath) {
    throw new Error("RevenueCat pagination exceeded 100 pages");
  }
  return items;
}

async function fetchRevenueCatObject(env: Env, path: string): Promise<object> {
  const apiKey = requiredConfiguration(env.REVENUECAT_API_KEY, "server API key");
  const response = await fetch(new URL(path, "https://api.revenuecat.com"), {
    headers: {
      accept: "application/json",
      authorization: `Bearer ${apiKey}`,
    },
  });
  if (!response.ok) {
    throw new Error(`RevenueCat customer verification failed (${response.status})`);
  }
  const payload: unknown = await response.json().catch(() => null);
  if (typeof payload !== "object" || payload === null) {
    throw new Error("RevenueCat returned an invalid JSON object");
  }
  return payload;
}

function nextPagePath(payload: object, projectId: string): string | null {
  const nextPage = Reflect.get(payload, "next_page");
  if (nextPage === null) {
    return null;
  }
  if (typeof nextPage !== "string") {
    throw new Error("RevenueCat returned an invalid pagination cursor");
  }
  const url = new URL(nextPage, "https://api.revenuecat.com");
  if (
    url.origin !== "https://api.revenuecat.com" ||
    !url.pathname.startsWith(`/v2/projects/${encodeURIComponent(projectId)}/`)
  ) {
    throw new Error("RevenueCat returned an unsafe pagination URL");
  }
  return `${url.pathname}${url.search}`;
}

function environmentField(value: object): RevenueCatEvent["environment"] | null {
  const environment = stringField(value, "environment");
  return environment === "production" || environment === "sandbox" ? environment : null;
}

function providerField(value: object): StoreProvider | null {
  const store = stringField(value, "store");
  if (store === "app_store" || store === "mac_app_store") {
    return "apple";
  }
  return store === "play_store" ? "google" : null;
}

function identifierField(value: object, key: string): string | null {
  const field = Reflect.get(value, key);
  if (typeof field === "string" && field.length > 0 && field.length <= 1_500) {
    return field;
  }
  return typeof field === "number" && Number.isSafeInteger(field) && field >= 0
    ? String(field)
    : null;
}

function stringField(value: object, key: string): string | null {
  const field = Reflect.get(value, key);
  return typeof field === "string" && field.length > 0 && field.length <= 1_500 ? field : null;
}

function integerField(value: object, key: string): number | null {
  const field = Reflect.get(value, key);
  return typeof field === "number" && Number.isSafeInteger(field) && field >= 0 ? field : null;
}

function nullableIntegerField(value: object, key: string): number | null {
  return Reflect.get(value, key) === null ? null : integerField(value, key);
}

function booleanField(value: object, key: string): boolean | null {
  const field = Reflect.get(value, key);
  return typeof field === "boolean" ? field : null;
}

function requiredConfiguration(value: string | undefined, label: string): string {
  const configured = value?.trim();
  if (!configured) {
    throw new Error(`RevenueCat ${label} is not configured`);
  }
  return configured;
}
