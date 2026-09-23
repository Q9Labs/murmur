export type MurmurCustomer = {
  allowanceMs: number;
  availableMs: number;
  creditMs: number;
  customerId: string;
  earliestExpiryAtMs: number | null;
  fulfillmentEnabled: boolean;
  features?: { phoneAudio: boolean; history: boolean; maxSessionSeconds: number };
  gifts?: { phoneAudio: { claimable: boolean; remainingMs: number } };
  entitlements?: { pro: boolean; proMax: boolean };
  isRegistered: boolean;
  negativeMs: number;
  plan: "free" | "pro" | "pro_max";
  purchasesEnabled: boolean;
  revenueCatCustomerId: string;
};

type CustomerBalance = Pick<
  MurmurCustomer,
  "allowanceMs" | "availableMs" | "creditMs" | "earliestExpiryAtMs" | "negativeMs"
>;

type CustomerMetadata = Pick<
  MurmurCustomer,
  "fulfillmentEnabled" | "isRegistered" | "plan" | "purchasesEnabled"
> & { revenueCatCustomerId?: string };

export function decodeCustomer(payload: unknown): MurmurCustomer | null {
  if (typeof payload !== "object" || payload === null) {
    return null;
  }
  const customerId = Reflect.get(payload, "customer_id");
  const balance = decodeBalance(Reflect.get(payload, "balance"));
  const metadata = decodeMetadata(payload);
  const features = decodeFeatures(Reflect.get(payload, "features"));
  const gifts = decodeGifts(Reflect.get(payload, "gifts"));
  const entitlements = decodeEntitlements(Reflect.get(payload, "entitlements"));
  if (!isValidCustomerId(customerId) || balance === null || metadata === null ||
    features === null || gifts === null || entitlements === null) {
    return null;
  }

  return {
    ...balance,
    customerId,
    fulfillmentEnabled: metadata.fulfillmentEnabled,
    ...(features ? { features } : {}),
    ...(gifts ? { gifts } : {}),
    ...(entitlements ? { entitlements } : {}),
    isRegistered: metadata.isRegistered,
    plan: metadata.plan,
    purchasesEnabled: metadata.purchasesEnabled,
    revenueCatCustomerId: metadata.revenueCatCustomerId ?? customerId,
  };
}

function decodeFeatures(value: unknown): MurmurCustomer["features"] | null {
  if (value === undefined) return undefined;
  if (typeof value !== "object" || value === null) return null;
  const phoneAudio = Reflect.get(value, "phone_audio");
  const history = Reflect.get(value, "history");
  const maxSessionSeconds = Reflect.get(value, "max_session_seconds");
  return typeof phoneAudio === "boolean" && typeof history === "boolean" &&
    typeof maxSessionSeconds === "number" && Number.isInteger(maxSessionSeconds) && maxSessionSeconds > 0
    ? { phoneAudio, history, maxSessionSeconds }
    : null;
}

// fallow-ignore-next-line complexity
function decodeGifts(value: unknown): MurmurCustomer["gifts"] | null {
  if (value === undefined) return undefined;
  if (typeof value !== "object" || value === null) return null;
  const phoneAudio = Reflect.get(value, "phone_audio");
  if (typeof phoneAudio !== "object" || phoneAudio === null) return null;
  const claimable = Reflect.get(phoneAudio, "claimable");
  const remainingMs = Reflect.get(phoneAudio, "remaining_ms");
  return typeof claimable === "boolean" && typeof remainingMs === "number" &&
    Number.isInteger(remainingMs) && remainingMs >= 0
    ? { phoneAudio: { claimable, remainingMs } }
    : null;
}

function decodeEntitlements(value: unknown): MurmurCustomer["entitlements"] | null {
  if (value === undefined) return undefined;
  if (typeof value !== "object" || value === null) return null;
  const pro = Reflect.get(value, "pro");
  const proMax = Reflect.get(value, "pro_max");
  return typeof pro === "boolean" && typeof proMax === "boolean" ? { pro, proMax } : null;
}

function decodeBalance(value: unknown): CustomerBalance | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const allowanceMs = nonnegativeInteger(value, "allowance_ms");
  const availableMs = integer(value, "available_ms");
  const creditMs = nonnegativeInteger(value, "credit_ms");
  const earliestExpiryAtMs = nullableInteger(value, "earliest_expiry_at_ms");
  const negativeMs = nonnegativeInteger(value, "negative_ms");
  if (
    allowanceMs === null ||
    availableMs === null ||
    creditMs === null ||
    earliestExpiryAtMs === undefined ||
    negativeMs === null
  ) {
    return null;
  }
  return { allowanceMs, availableMs, creditMs, earliestExpiryAtMs, negativeMs };
}

function decodeMetadata(payload: object): CustomerMetadata | null {
  const fulfillmentEnabled = optionalBoolean(Reflect.get(payload, "fulfillment_enabled"), true);
  const isRegistered = requiredBoolean(Reflect.get(payload, "is_registered"));
  const plan = customerPlan(Reflect.get(payload, "plan"));
  const purchasesEnabled = requiredBoolean(Reflect.get(payload, "purchases_enabled"));
  const revenueCatCustomerId = optionalCustomerId(Reflect.get(payload, "revenuecat_customer_id"));
  if (
    fulfillmentEnabled === null ||
    isRegistered === null ||
    plan === null ||
    purchasesEnabled === null ||
    revenueCatCustomerId === null
  ) {
    return null;
  }
  return {
    fulfillmentEnabled,
    isRegistered,
    plan,
    purchasesEnabled,
    revenueCatCustomerId,
  };
}

function requiredBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function optionalBoolean(value: unknown, fallback: boolean): boolean | null {
  return value === undefined ? fallback : requiredBoolean(value);
}

function customerPlan(value: unknown): MurmurCustomer["plan"] | null {
  return value === "free" || value === "pro" || value === "pro_max" ? value : null;
}

function optionalCustomerId(value: unknown): string | null | undefined {
  return value === undefined ? undefined : isValidCustomerId(value) ? value : null;
}

function isValidCustomerId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 255;
}

export function readCustomerError(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null) {
    return null;
  }
  const error = Reflect.get(payload, "error");
  return typeof error === "string" ? error : null;
}

function integer(value: object, key: string): number | null {
  const field = Reflect.get(value, key);
  return typeof field === "number" && Number.isInteger(field) ? field : null;
}

function nonnegativeInteger(value: object, key: string): number | null {
  const field = integer(value, key);
  return field !== null && field >= 0 ? field : null;
}

function nullableInteger(value: object, key: string): number | null | undefined {
  const field = Reflect.get(value, key);
  return field === null
    ? null
    : typeof field === "number" && Number.isInteger(field)
      ? field
      : undefined;
}
