export type MurmurCustomer = {
  allowanceMs: number;
  availableMs: number;
  creditMs: number;
  customerId: string;
  earliestExpiryAtMs: number | null;
  isRegistered: boolean;
  negativeMs: number;
  plan: "free" | "pro";
  purchasesEnabled: boolean;
};

export function decodeCustomer(payload: unknown): MurmurCustomer | null {
  if (typeof payload !== "object" || payload === null) {
    return null;
  }
  const balance = Reflect.get(payload, "balance");
  const customerId = Reflect.get(payload, "customer_id");
  const isRegistered = Reflect.get(payload, "is_registered");
  const plan = Reflect.get(payload, "plan");
  const purchasesEnabled = Reflect.get(payload, "purchases_enabled");
  if (typeof balance !== "object" || balance === null || typeof customerId !== "string") {
    return null;
  }

  const allowanceMs = nonnegativeInteger(balance, "allowance_ms");
  const availableMs = integer(balance, "available_ms");
  const creditMs = nonnegativeInteger(balance, "credit_ms");
  const earliestExpiryAtMs = nullableInteger(balance, "earliest_expiry_at_ms");
  const negativeMs = nonnegativeInteger(balance, "negative_ms");
  if (
    allowanceMs === null ||
    availableMs === null ||
    creditMs === null ||
    earliestExpiryAtMs === undefined ||
    typeof isRegistered !== "boolean" ||
    negativeMs === null ||
    (plan !== "free" && plan !== "pro") ||
    typeof purchasesEnabled !== "boolean"
  ) {
    return null;
  }

  return {
    allowanceMs,
    availableMs,
    creditMs,
    customerId,
    earliestExpiryAtMs,
    isRegistered,
    negativeMs,
    plan,
    purchasesEnabled,
  };
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
