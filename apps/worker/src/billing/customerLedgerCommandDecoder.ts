import type {
  BootstrapGuestCommand,
  CloseUsageSessionCommand,
  CustomerLedgerCommand,
  DeleteCustomerCommand,
  GetBalanceCommand,
  GrantValueCommand,
  OpenUsageSessionCommand,
  RestoreGrantCommand,
  ReverseGrantCommand,
  SettleUsageCommand,
} from "./contracts";

type CommonCommand = {
  customerId: string;
  nowMs: number;
};

type CommandDecoder = (
  value: object,
  common: CommonCommand,
) => CustomerLedgerCommand | null;

type GrantValueCore = Pick<
  GrantValueCommand,
  "amountMs" | "grantKey" | "grantKind" | "startsAtMs"
>;

type GrantValueReferences = Pick<
  GrantValueCommand,
  "expiresAtMs" | "storeEventRowId" | "storeTransactionRowId"
>;

const commandDecoders = new Map<string, CommandDecoder>([
  ["bootstrap_guest", decodeBootstrapGuest],
  ["close_usage_session", decodeCloseUsageSession],
  ["delete_customer", decodeDeleteCustomer],
  ["get_balance", decodeGetBalance],
  ["grant_value", decodeGrantValue],
  ["open_usage_session", decodeOpenUsageSession],
  ["restore_grant", decodeRestoreGrant],
  ["reverse_grant", decodeReverseGrant],
  ["settle_usage", decodeSettleUsage],
]);

export function decodeCustomerLedgerCommand(value: unknown): CustomerLedgerCommand | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const action = requiredString(value, "action");
  const customerId = requiredString(value, "customerId");
  const nowMs = requiredInteger(value, "nowMs");
  if (!action || !customerId || nowMs === null) {
    return null;
  }
  const decoder = commandDecoders.get(action);
  return decoder ? decoder(value, { customerId, nowMs }) : null;
}

function decodeBootstrapGuest(
  value: object,
  common: CommonCommand,
): BootstrapGuestCommand | null {
  const periodExpiresAtMs = requiredInteger(value, "periodExpiresAtMs");
  const periodKey = requiredString(value, "periodKey");
  const periodStartsAtMs = requiredInteger(value, "periodStartsAtMs");
  const grantFreeAllowance = Reflect.get(value, "grantFreeAllowance");
  const principalId = requiredString(value, "principalId");
  const principalProvider = Reflect.get(value, "principalProvider");
  const providerSubject = requiredString(value, "providerSubject");
  if (
    periodExpiresAtMs === null ||
    !periodKey ||
    periodStartsAtMs === null ||
    typeof grantFreeAllowance !== "boolean" ||
    !principalId ||
    (principalProvider !== "anonymous" && principalProvider !== "email") ||
    !providerSubject
  ) {
    return null;
  }
  return {
    action: "bootstrap_guest",
    ...common,
    grantFreeAllowance,
    periodExpiresAtMs,
    periodKey,
    periodStartsAtMs,
    principalId,
    principalProvider,
    providerSubject,
  };
}

function decodeCloseUsageSession(
  value: object,
  common: CommonCommand,
): CloseUsageSessionCommand | null {
  const outcome = Reflect.get(value, "outcome");
  const usageSessionId = requiredString(value, "usageSessionId");
  if ((outcome !== "closed" && outcome !== "failed") || !usageSessionId) {
    return null;
  }
  return { action: "close_usage_session", ...common, outcome, usageSessionId };
}

function decodeDeleteCustomer(
  _value: object,
  common: CommonCommand,
): DeleteCustomerCommand {
  return { action: "delete_customer", ...common };
}

function decodeGetBalance(
  _value: object,
  common: CommonCommand,
): GetBalanceCommand {
  return { action: "get_balance", ...common };
}

function decodeGrantValue(
  value: object,
  common: CommonCommand,
): GrantValueCommand | null {
  const core = decodeGrantValueCore(value);
  const references = decodeGrantValueReferences(value);
  if (!core || !references) {
    return null;
  }
  return { action: "grant_value", ...common, ...core, ...references };
}

function decodeGrantValueCore(value: object): GrantValueCore | null {
  const amountMs = requiredPositiveInteger(value, "amountMs");
  const grantKey = requiredString(value, "grantKey");
  const grantKind = decodeGrantKind(value);
  const startsAtMs = requiredInteger(value, "startsAtMs");
  if (amountMs === null || !grantKey || !grantKind || startsAtMs === null) {
    return null;
  }
  return { amountMs, grantKey, grantKind, startsAtMs };
}

function decodeGrantValueReferences(value: object): GrantValueReferences | null {
  const expiresAtMs = nullableInteger(value, "expiresAtMs");
  const storeEventRowId = nullableString(value, "storeEventRowId");
  const storeTransactionRowId = nullableString(value, "storeTransactionRowId");
  if (
    expiresAtMs === undefined ||
    storeEventRowId === undefined ||
    storeTransactionRowId === undefined
  ) {
    return null;
  }
  return { expiresAtMs, storeEventRowId, storeTransactionRowId };
}

function decodeGrantKind(value: object): GrantValueCommand["grantKind"] | null {
  const field = Reflect.get(value, "grantKind");
  switch (field) {
    case "credit_pack":
    case "free":
    case "pro":
      return field;
    default:
      return null;
  }
}

function decodeOpenUsageSession(
  value: object,
  common: CommonCommand,
): OpenUsageSessionCommand | null {
  const usageSessionId = requiredString(value, "usageSessionId");
  return usageSessionId
    ? { action: "open_usage_session", ...common, usageSessionId }
    : null;
}

function decodeRestoreGrant(
  value: object,
  common: CommonCommand,
): RestoreGrantCommand | null {
  const grantId = requiredString(value, "grantId");
  const originalRefundEventId = requiredString(value, "originalRefundEventId");
  const restorationEventId = requiredString(value, "restorationEventId");
  const storeEventRowId = nullableString(value, "storeEventRowId");
  if (!grantId || !originalRefundEventId || !restorationEventId || storeEventRowId === undefined) {
    return null;
  }
  return {
    action: "restore_grant",
    ...common,
    grantId,
    originalRefundEventId,
    restorationEventId,
    storeEventRowId,
  };
}

function decodeReverseGrant(
  value: object,
  common: CommonCommand,
): ReverseGrantCommand | null {
  const grantId = requiredString(value, "grantId");
  const refundEventId = requiredString(value, "refundEventId");
  const storeEventRowId = nullableString(value, "storeEventRowId");
  if (!grantId || !refundEventId || storeEventRowId === undefined) {
    return null;
  }
  return { action: "reverse_grant", ...common, grantId, refundEventId, storeEventRowId };
}

function decodeSettleUsage(
  value: object,
  common: CommonCommand,
): SettleUsageCommand | null {
  const amountMs = requiredPositiveInteger(value, "amountMs");
  const settlementSequence = requiredPositiveInteger(value, "settlementSequence");
  const usageSessionId = requiredString(value, "usageSessionId");
  if (amountMs === null || settlementSequence === null || !usageSessionId) {
    return null;
  }
  return {
    action: "settle_usage",
    ...common,
    amountMs,
    settlementSequence,
    usageSessionId,
  };
}

function requiredString(value: object, key: string): string | null {
  const field = Reflect.get(value, key);
  return typeof field === "string" && field.length > 0 ? field : null;
}

function nullableString(value: object, key: string): string | null | undefined {
  const field = Reflect.get(value, key);
  if (field === null) {
    return null;
  }
  return typeof field === "string" && field.length > 0 ? field : undefined;
}

function requiredInteger(value: object, key: string): number | null {
  const field = Reflect.get(value, key);
  return typeof field === "number" && Number.isInteger(field) ? field : null;
}

function requiredPositiveInteger(value: object, key: string): number | null {
  const field = requiredInteger(value, key);
  return field !== null && field > 0 ? field : null;
}

function nullableInteger(value: object, key: string): number | null | undefined {
  const field = Reflect.get(value, key);
  if (field === null) {
    return null;
  }
  return typeof field === "number" && Number.isInteger(field) ? field : undefined;
}
