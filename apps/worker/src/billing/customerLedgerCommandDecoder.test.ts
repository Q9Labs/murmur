import { describe, expect, it } from "vitest";

import { decodeCustomerLedgerCommand } from "./customerLedgerCommandDecoder";

describe("customer ledger command decoder", () => {
  it.each([
    ["balance", { action: "get_balance", customerId: "customer-1", nowMs: 1 }],
    ["deletion", { action: "delete_customer", customerId: "customer-1", nowMs: 1 }],
    ["session opening", {
      action: "open_usage_session",
      customerId: "customer-1",
      nowMs: 1,
      usageSessionId: "session-1",
    }],
    ["session closure", {
      action: "close_usage_session",
      customerId: "customer-1",
      nowMs: 1,
      outcome: "closed",
      usageSessionId: "session-1",
    }],
    ["usage settlement", {
      action: "settle_usage",
      amountMs: 1_000,
      customerId: "customer-1",
      nowMs: 1,
      settlementSequence: 1,
      usageSessionId: "session-1",
    }],
    ["guest bootstrap", {
      action: "bootstrap_guest",
      customerId: "customer-1",
      grantFreeAllowance: true,
      nowMs: 1,
      periodExpiresAtMs: 3,
      periodKey: "free:2026-08",
      periodStartsAtMs: 2,
      principalId: "principal-1",
      principalProvider: "anonymous",
      providerSubject: "install-1",
    }],
    ["value grant", {
      action: "grant_value",
      amountMs: 60_000,
      customerId: "customer-1",
      expiresAtMs: null,
      grantKey: "store:transaction-1",
      grantKind: "credit_pack",
      nowMs: 1,
      startsAtMs: 1,
      storeEventRowId: "event-1",
      storeTransactionRowId: "transaction-1",
    }],
    ["grant reversal", {
      action: "reverse_grant",
      customerId: "customer-1",
      grantId: "grant-1",
      nowMs: 1,
      refundEventId: "refund-1",
      storeEventRowId: "event-1",
    }],
    ["grant restoration", {
      action: "restore_grant",
      customerId: "customer-1",
      grantId: "grant-1",
      nowMs: 1,
      originalRefundEventId: "refund-1",
      restorationEventId: "restoration-1",
      storeEventRowId: "event-1",
    }],
  ])("decodes %s commands", (_name, command) => {
    expect(decodeCustomerLedgerCommand(command)).toEqual(command);
  });

  it.each([
    null,
    {},
    { action: "unknown", customerId: "customer-1", nowMs: 1 },
    { action: "get_balance", customerId: "", nowMs: 1 },
    { action: "settle_usage", amountMs: 0, customerId: "customer-1", nowMs: 1 },
    { action: "grant_value", amountMs: 1, customerId: "customer-1", nowMs: 1 },
  ])("rejects malformed commands", (command) => {
    expect(decodeCustomerLedgerCommand(command)).toBeNull();
  });
});
