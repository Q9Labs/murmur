export type MurmurCustomer = {
  allowanceMs: number;
  availableMs: number;
  creditMs: number;
  customerId: string;
  earliestExpiryAtMs: number | null;
  fulfillmentEnabled: boolean;
  isRegistered: boolean;
  negativeMs: number;
  plan: "free" | "pro";
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
  if (!isValidCustomerId(customerId) || balance === null || metadata === null) {
    return null;
  }

  return {
    ...balance,
    customerId,
    fulfillmentEnabled: metadata.fulfillmentEnabled,
    isRegistered: metadata.isRegistered,
    plan: metadata.plan,
    purchasesEnabled: metadata.purchasesEnabled,
    revenueCatCustomerId: metadata.revenueCatCustomerId ?? customerId,
  };
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
  return value === "free" || value === "pro" ? value : null;
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
