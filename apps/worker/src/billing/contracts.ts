import type { GrantDebit } from "./allocation";

export type LedgerBalance = {
  allowanceMs: number;
  availableMs: number;
  creditMs: number;
  earliestExpiryAtMs: number | null;
  negativeMs: number;
};

export type BootstrapGuestCommand = {
  action: "bootstrap_guest";
  customerId: string;
  nowMs: number;
  periodExpiresAtMs: number;
  periodKey: string;
  periodStartsAtMs: number;
  principalId: string;
  principalProvider: "anonymous" | "email";
  providerSubject: string;
};

export type GetBalanceCommand = {
  action: "get_balance";
  customerId: string;
  nowMs: number;
};

export type DeleteCustomerCommand = {
  action: "delete_customer";
  customerId: string;
  nowMs: number;
};

export type GrantValueCommand = {
  action: "grant_value";
  amountMs: number;
  customerId: string;
  expiresAtMs: number | null;
  grantKey: string;
  grantKind: "free" | "pro" | "credit_pack";
  nowMs: number;
  startsAtMs: number;
  storeEventRowId: string | null;
  storeTransactionRowId: string | null;
};

export type OpenUsageSessionCommand = {
  action: "open_usage_session";
  customerId: string;
  nowMs: number;
  usageSessionId: string;
};

export type SettleUsageCommand = {
  action: "settle_usage";
  amountMs: number;
  customerId: string;
  nowMs: number;
  settlementSequence: number;
  usageSessionId: string;
};

export type CloseUsageSessionCommand = {
  action: "close_usage_session";
  customerId: string;
  nowMs: number;
  outcome: "closed" | "failed";
  usageSessionId: string;
};

export type ReverseGrantCommand = {
  action: "reverse_grant";
  customerId: string;
  grantId: string;
  nowMs: number;
  refundEventId: string;
  storeEventRowId: string | null;
};

export type RestoreGrantCommand = {
  action: "restore_grant";
  customerId: string;
  grantId: string;
  nowMs: number;
  originalRefundEventId: string;
  restorationEventId: string;
  storeEventRowId: string | null;
};

export type CustomerLedgerCommand =
  | BootstrapGuestCommand
  | CloseUsageSessionCommand
  | DeleteCustomerCommand
  | GetBalanceCommand
  | GrantValueCommand
  | OpenUsageSessionCommand
  | ReverseGrantCommand
  | RestoreGrantCommand
  | SettleUsageCommand;

export type LedgerCommandResult =
  | { balance: LedgerBalance; created: boolean; ok: true }
  | { balance: LedgerBalance; generation: number; ok: true; usageSessionId: string }
  | { balance: LedgerBalance; idempotent: boolean; ok: true }
  | { idempotent: boolean; ok: true; usageSessionId: string }
  | { deleted: boolean; ok: true }
  | { allocations: GrantDebit[]; balance: LedgerBalance; idempotent: boolean; ok: true }
  | { availableMs: number; code: "allowance_exhausted"; ok: false }
  | { code: "billing_unavailable" | "customer_deleted" | "customer_mismatch"; ok: false }
  | { code: "invalid_ledger_command" | "usage_session_closed"; ok: false };
