export type MurmurCustomer = {
  allowanceMs: number;
  availableMs: number;
  creditMs: number;
  customerId: string;
  creditPacks: { expiresAtMs: number; grantId: string; remainingMs: number }[];
  earliestExpiryAtMs: number | null;
  entitlements: { pro: boolean; proMax: boolean };
  features: { history: boolean; maxSessionSeconds: number; phoneAudio: boolean };
  fulfillmentEnabled: boolean;
  gifts?: { phoneAudio: { claimable: boolean; remainingMs: number } };
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
  const entitlements = decodeEntitlements(Reflect.get(payload, "entitlements"));
  const features = decodeFeatures(Reflect.get(payload, "features"));
  const gifts = decodeGifts(Reflect.get(payload, "gifts"));
  const creditPacks = decodeCreditPacks(Reflect.get(payload, "credit_packs"));
  if (!isValidCustomerId(customerId) || balance === null || metadata === null ||
    entitlements === null || features === null || gifts === null || creditPacks === null) {
    return null;
  }

  return {
    ...balance,
    customerId,
    creditPacks,
    entitlements: entitlements ?? { pro: metadata.plan !== "free", proMax: metadata.plan === "pro_max" },
    features: features ?? {
      history: metadata.plan !== "free",
      maxSessionSeconds: metadata.plan === "free" ? 300 : 3_600,
      phoneAudio: metadata.plan !== "free",
    },
    fulfillmentEnabled: metadata.fulfillmentEnabled,
    ...(gifts ? { gifts } : {}),
    isRegistered: metadata.isRegistered,
    plan: metadata.plan,
    purchasesEnabled: metadata.purchasesEnabled,
    revenueCatCustomerId: metadata.revenueCatCustomerId ?? customerId,
  };
}

function decodeFeatures(value: unknown): MurmurCustomer["features"] | null | undefined {
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
function decodeGifts(value: unknown): MurmurCustomer["gifts"] | null | undefined {
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

function decodeEntitlements(value: unknown): MurmurCustomer["entitlements"] | null | undefined {
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

function decodeCreditPacks(value: unknown): MurmurCustomer["creditPacks"] | null {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    return null;
  }
  const packs: MurmurCustomer["creditPacks"] = [];
  for (const item of value) {
    const pack = decodeCreditPack(item);
    if (!pack) {
      return null;
    }
    packs.push(pack);
  }
  return packs;
}

function decodeCreditPack(item: unknown): MurmurCustomer["creditPacks"][number] | null {
  if (typeof item !== "object" || item === null) {
    return null;
  }
  const grantId = Reflect.get(item, "grant_id");
  const remainingMs = nonnegativeInteger(item, "remaining_ms");
  const expiresAtMs = nonnegativeInteger(item, "expires_at_ms");
  if (typeof grantId !== "string" || grantId.length === 0 ||
    remainingMs === null || expiresAtMs === null) {
    return null;
  }
  return { grantId, remainingMs, expiresAtMs };
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
