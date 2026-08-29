import type { StoreProvider } from "./catalog";

export type RevenueCatEvent = {
  aliases: string[];
  appUserId: string;
  cancelReason: string | null;
  environment: "production" | "sandbox";
  eventId: string;
  eventTimestampMs: number;
  expirationAtMs: number | null;
  originalAppUserId: string;
  originalPurchasedAtMs: number | null;
  originalTransactionId: string | null;
  productId: string | null;
  provider: StoreProvider | null;
  purchasedAtMs: number | null;
  transactionId: string | null;
  type: string;
};

export type IgnoredRevenueCatEvent = {
  eventId: string;
  type: string;
};

export function isIgnoredRevenueCatEventType(type: string): boolean {
  switch (type) {
    case "TEST":
    case "TRANSFER":
    case "TEMPORARY_ENTITLEMENT_GRANT":
    case "VIRTUAL_CURRENCY_TRANSACTION":
    case "EXPERIMENT_ENROLLMENT":
    case "PURCHASE_REDEEMED":
    case "SUBSCRIBER_ALIAS":
    case "PRICE_INCREASE_CONSENT_REQUIRED":
    case "PRICE_INCREASE_CONSENT_APPROVED":
    case "PRODUCT_CHANGE":
    case "INVOICE_ISSUANCE":
      return true;
    default:
      return false;
  }
}

export function decodeIgnoredRevenueCatEvent(payload: unknown): IgnoredRevenueCatEvent | null {
  const event = revenueCatEventObject(payload);
  if (!event) {
    return null;
  }
  const eventId = requiredString(event, "id");
  const type = requiredString(event, "type");
  if (!eventId || !type || !isIgnoredRevenueCatEventType(type)) {
    return null;
  }
  return { eventId, type };
}

export function decodeRevenueCatEvent(payload: unknown): RevenueCatEvent | null {
  const event = revenueCatEventObject(payload);
  if (!event) {
    return null;
  }
  const appUserId = requiredString(event, "app_user_id");
  const environment = Reflect.get(event, "environment");
  const eventId = requiredString(event, "id");
  const eventTimestampMs = requiredInteger(event, "event_timestamp_ms");
  const originalAppUserId = requiredString(event, "original_app_user_id") ?? appUserId;
  const type = requiredString(event, "type");
  if (
    !appUserId ||
    (environment !== "PRODUCTION" && environment !== "SANDBOX") ||
    !eventId ||
    eventTimestampMs === null ||
    !originalAppUserId ||
    !type
  ) {
    return null;
  }
  const store = Reflect.get(event, "store");
  const provider = store === "APP_STORE"
    ? "apple"
    : store === "PLAY_STORE"
      ? "google"
      : null;
  return {
    aliases: stringArray(event, "aliases"),
    appUserId,
    cancelReason: optionalString(event, "cancel_reason"),
    environment: environment === "PRODUCTION" ? "production" : "sandbox",
    eventId,
    eventTimestampMs,
    expirationAtMs: nullableInteger(event, "expiration_at_ms"),
    originalAppUserId,
    originalPurchasedAtMs: optionalInteger(event, "original_purchase_at_ms"),
    originalTransactionId: optionalString(event, "original_transaction_id"),
    productId: optionalString(event, "product_id"),
    provider,
    purchasedAtMs: optionalInteger(event, "purchased_at_ms"),
    transactionId: optionalString(event, "transaction_id"),
    type,
  };
}

function revenueCatEventObject(payload: unknown): object | null {
  if (typeof payload !== "object" || payload === null ||
    Reflect.get(payload, "api_version") !== "1.0") {
    return null;
  }
  const event = Reflect.get(payload, "event");
  return typeof event === "object" && event !== null ? event : null;
}

export function revenueCatCustomerIds(event: RevenueCatEvent): string[] {
  return [...new Set([event.appUserId, event.originalAppUserId, ...event.aliases])];
}

function requiredString(value: object, key: string): string | null {
  const field = Reflect.get(value, key);
  return typeof field === "string" && field.length > 0 && field.length <= 512 ? field : null;
}

function optionalString(value: object, key: string): string | null {
  return requiredString(value, key);
}

function requiredInteger(value: object, key: string): number | null {
  const field = Reflect.get(value, key);
  return typeof field === "number" && Number.isSafeInteger(field) && field >= 0 ? field : null;
}

function optionalInteger(value: object, key: string): number | null {
  return requiredInteger(value, key);
}

function nullableInteger(value: object, key: string): number | null {
  const field = Reflect.get(value, key);
  return field === null ? null : requiredInteger(value, key);
}

function stringArray(value: object, key: string): string[] {
  const field = Reflect.get(value, key);
  if (!Array.isArray(field)) {
    return [];
  }
  return field.filter(
    (item): item is string => typeof item === "string" && item.length > 0 && item.length <= 512,
  );
}
