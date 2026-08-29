/// <reference types="@cloudflare/workers-types" />

import { allocateDebit, type GrantDebit, type SpendableGrant } from "./allocation";
import { freeAllowanceMs } from "./catalog";
import type {
  BootstrapGuestCommand,
  CloseUsageSessionCommand,
  DeleteCustomerCommand,
  GrantValueCommand,
  LedgerBalance,
  ReverseGrantCommand,
  RestoreGrantCommand,
  SettleUsageCommand,
} from "./contracts";

type CustomerRow = {
  customer_id: string;
  state: "active" | "deleted" | "deleting";
};

type PrincipalRow = {
  customer_id: string;
};

type BalanceRow = {
  allowance_ms: number;
  available_ms: number;
  credit_ms: number;
  earliest_expiry_at_ms: number | null;
  negative_ms: number;
};

type GrantRow = {
  created_at_ms: number;
  expires_at_ms: number | null;
  grant_id: string;
  original_ms: number;
  remaining_ms: number;
};

type UsageSessionRow = {
  customer_id: string;
  generation: number;
  state: "closed" | "failed" | "open";
};

type UsageSettlementRow = {
  amount_ms: number;
};

type RefundReversalRow = {
  reversed_ms: number;
};

const emptyBalanceRow: BalanceRow = {
  allowance_ms: 0,
  available_ms: 0,
  credit_ms: 0,
  earliest_expiry_at_ms: null,
  negative_ms: 0,
};

export class LedgerRepository {
  constructor(private readonly database: D1Database) {}

  async bootstrapGuest(command: BootstrapGuestCommand): Promise<{
    balance: LedgerBalance;
    created: boolean;
  }> {
    const existingCustomer = await this.getCustomer(command.customerId);
    if (existingCustomer?.state === "deleted" || existingCustomer?.state === "deleting") {
      throw new CustomerDeletedError();
    }

    const results = await this.database.batch([
      this.database
        .prepare(
          `INSERT OR IGNORE INTO customers
            (customer_id, state, created_at_ms, updated_at_ms, deleted_at_ms)
           VALUES (?, 'active', ?, ?, NULL)`,
        )
        .bind(command.customerId, command.nowMs, command.nowMs),
      this.database
        .prepare(
          `INSERT OR IGNORE INTO customer_principals
            (principal_id, customer_id, provider, provider_subject, created_at_ms, revoked_at_ms)
           VALUES (?, ?, ?, ?, ?, NULL)`,
        )
        .bind(
          command.principalId,
          command.customerId,
          command.principalProvider,
          command.providerSubject,
          command.nowMs,
        ),
      this.database
        .prepare(
          `INSERT OR IGNORE INTO projection_versions
            (customer_id, version, last_ledger_entry_id, rebuilt_at_ms, updated_at_ms)
           VALUES (?, 0, NULL, NULL, ?)`,
        )
        .bind(command.customerId, command.nowMs),
    ]);

    const principal = await this.database
      .prepare(
        `SELECT customer_id
         FROM customer_principals
         WHERE provider = ? AND provider_subject = ?`,
      )
      .bind(command.principalProvider, command.providerSubject)
      .first<PrincipalRow>();
    if (!principal || principal.customer_id !== command.customerId) {
      throw new CustomerMismatchError();
    }
    if (command.grantFreeAllowance) {
      await this.grantFreeAllowance(command);
    }

    return {
      balance: await this.getBalance(command.customerId, command.nowMs),
      created: results[0]?.meta.changes === 1,
    };
  }

  private async grantFreeAllowance(command: BootstrapGuestCommand): Promise<void> {
    const idempotencyKey = `${command.customerId}:${command.periodKey}`;
    const ledgerEntryId = `ledger:${idempotencyKey}`;
    const grantId = `grant:${idempotencyKey}`;
    const existing = await this.database
      .prepare("SELECT grant_id FROM balance_grants WHERE grant_id = ?")
      .bind(grantId)
      .first<{ grant_id: string }>();
    if (existing) {
      return;
    }

    const results = await this.database.batch([
      this.database
        .prepare(
          `INSERT INTO allowance_periods
            (allowance_period_id, customer_id, allowance_kind, period_key, starts_at_ms,
             expires_at_ms, allowance_ms, created_at_ms)
           VALUES (?, ?, 'free', ?, ?, ?, ?, ?)`,
        )
        .bind(
          `period:${idempotencyKey}`,
          command.customerId,
          command.periodKey,
          command.periodStartsAtMs,
          command.periodExpiresAtMs,
          freeAllowanceMs,
          command.nowMs,
        ),
      this.database
        .prepare(
          `INSERT INTO ledger_entries
            (ledger_entry_id, customer_id, entry_kind, amount_ms, idempotency_key, grant_id,
             usage_session_id, store_transaction_row_id, store_event_row_id,
             reverses_ledger_entry_id, metadata_json, created_at_ms)
           VALUES (?, ?, 'grant', ?, ?, ?, NULL, NULL, NULL, NULL, ?, ?)`,
        )
        .bind(
          ledgerEntryId,
          command.customerId,
          freeAllowanceMs,
          `free:${idempotencyKey}`,
          grantId,
          JSON.stringify({ allowance_kind: "free", period_key: command.periodKey }),
          command.nowMs,
        ),
      this.database
        .prepare(
          `INSERT INTO balance_grants
            (grant_id, customer_id, grant_kind, grant_key, original_ms, remaining_ms,
             valid_from_ms, expires_at_ms, state, source_ledger_entry_id,
             source_transaction_row_id, created_at_ms, updated_at_ms)
           VALUES (?, ?, 'free', ?, ?, ?, ?, ?, 'available', ?, NULL, ?, ?)`,
        )
        .bind(
          grantId,
          command.customerId,
          command.periodKey,
          freeAllowanceMs,
          freeAllowanceMs,
          command.periodStartsAtMs,
          command.periodExpiresAtMs,
          ledgerEntryId,
          command.nowMs,
          command.nowMs,
        ),
      this.database
        .prepare(
          `UPDATE projection_versions
           SET version = version + 1,
               last_ledger_entry_id = ?,
               updated_at_ms = ?
           WHERE customer_id = ?`,
        )
        .bind(ledgerEntryId, command.nowMs, command.customerId),
    ]);
    requireChanges(results, [1, 1, 1, 1]);
  }

  async getBalance(customerId: string, nowMs: number): Promise<LedgerBalance> {
    const row = await this.database
      .prepare(
        `WITH billing_state AS (
           SELECT EXISTS(
             SELECT 1
             FROM subscriptions
             WHERE customer_id = ?
               AND state IN ('active', 'grace', 'billing_retry')
               AND paid_through_ms > ?
           ) AS has_pro
         )
         SELECT
           COALESCE(SUM(
             CASE
               WHEN remaining_ms < 0 THEN remaining_ms
               WHEN expires_at_ms IS NULL OR expires_at_ms > ? THEN remaining_ms
               ELSE 0
             END
           ), 0) AS available_ms,
           COALESCE(SUM(
             CASE
               WHEN grant_kind IN ('free', 'pro')
                 AND remaining_ms > 0
                 AND expires_at_ms > ?
               THEN remaining_ms
               ELSE 0
             END
           ), 0) AS allowance_ms,
           COALESCE(SUM(
             CASE
               WHEN grant_kind = 'credit_pack' AND remaining_ms > 0 THEN remaining_ms
               ELSE 0
             END
           ), 0) AS credit_ms,
           -COALESCE(SUM(CASE WHEN remaining_ms < 0 THEN remaining_ms ELSE 0 END), 0)
             AS negative_ms,
           MIN(
             CASE
               WHEN grant_kind IN ('free', 'pro')
                 AND remaining_ms > 0
                 AND expires_at_ms > ?
               THEN expires_at_ms
               ELSE NULL
             END
           ) AS earliest_expiry_at_ms
         FROM balance_grants, billing_state
         WHERE customer_id = ?
           AND (grant_kind != 'free' OR billing_state.has_pro = 0)`,
      )
      .bind(customerId, nowMs, nowMs, nowMs, nowMs, customerId)
      .first<BalanceRow>();

    return balanceFromRow(row ?? emptyBalanceRow);
  }

  async deleteCustomer(command: DeleteCustomerCommand): Promise<{ deleted: boolean }> {
    const customer = await this.getCustomer(command.customerId);
    if (!customer || customer.state === "deleted") {
      return { deleted: false };
    }
    const results = await this.database.batch([
      this.database
        .prepare(
          `UPDATE customers
           SET state = 'deleted', deleted_at_ms = ?, updated_at_ms = ?
           WHERE customer_id = ? AND state != 'deleted'`,
        )
        .bind(command.nowMs, command.nowMs, command.customerId),
      this.database
        .prepare(
          `UPDATE customer_principals
           SET revoked_at_ms = COALESCE(revoked_at_ms, ?)
           WHERE customer_id = ?`,
        )
        .bind(command.nowMs, command.customerId),
      this.database
        .prepare(
          `UPDATE usage_sessions
           SET state = 'failed', ended_at_ms = ?, updated_at_ms = ?
           WHERE customer_id = ? AND state = 'open'`,
        )
        .bind(command.nowMs, command.nowMs, command.customerId),
    ]);
    if (results[0]?.meta.changes !== 1) {
      throw new Error("customer deletion changed an unexpected row count");
    }
    return { deleted: true };
  }

  async grantValue(command: GrantValueCommand): Promise<{
    balance: LedgerBalance;
    idempotent: boolean;
  }> {
    await this.requireActiveCustomer(command.customerId);
    const existing = await this.database
      .prepare(
        `SELECT grant_id, original_ms, remaining_ms, expires_at_ms, created_at_ms
         FROM balance_grants
         WHERE customer_id = ? AND grant_key = ?`,
      )
      .bind(command.customerId, command.grantKey)
      .first<GrantRow>();
    if (existing) {
      if (
        existing.original_ms !== command.amountMs ||
        existing.expires_at_ms !== command.expiresAtMs
      ) {
        throw new Error("grant idempotency conflict");
      }
      return {
        balance: await this.getBalance(command.customerId, command.nowMs),
        idempotent: true,
      };
    }

    const grantId = `grant:${command.customerId}:${command.grantKey}`;
    const ledgerEntryId = `ledger:${command.customerId}:${command.grantKey}`;
    const results = await this.database.batch([
      this.database
        .prepare(
          `INSERT INTO ledger_entries
            (ledger_entry_id, customer_id, entry_kind, amount_ms, idempotency_key, grant_id,
             usage_session_id, store_transaction_row_id, store_event_row_id,
             reverses_ledger_entry_id, metadata_json, created_at_ms)
           VALUES (?, ?, 'grant', ?, ?, ?, NULL, ?, ?, NULL, ?, ?)`,
        )
        .bind(
          ledgerEntryId,
          command.customerId,
          command.amountMs,
          `grant:${command.customerId}:${command.grantKey}`,
          grantId,
          command.storeTransactionRowId,
          command.storeEventRowId,
          JSON.stringify({ grant_kind: command.grantKind, grant_key: command.grantKey }),
          command.nowMs,
        ),
      this.database
        .prepare(
          `INSERT INTO balance_grants
            (grant_id, customer_id, grant_kind, grant_key, original_ms, remaining_ms,
             valid_from_ms, expires_at_ms, state, source_ledger_entry_id,
             source_transaction_row_id, created_at_ms, updated_at_ms)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'available', ?, ?, ?, ?)`,
        )
        .bind(
          grantId,
          command.customerId,
          command.grantKind,
          command.grantKey,
          command.amountMs,
          command.amountMs,
          command.startsAtMs,
          command.expiresAtMs,
          ledgerEntryId,
          command.storeTransactionRowId,
          command.nowMs,
          command.nowMs,
        ),
      this.database
        .prepare(
          `INSERT INTO projection_versions
            (customer_id, version, last_ledger_entry_id, rebuilt_at_ms, updated_at_ms)
           VALUES (?, 1, ?, NULL, ?)
           ON CONFLICT(customer_id) DO UPDATE SET
             version = projection_versions.version + 1,
             last_ledger_entry_id = excluded.last_ledger_entry_id,
             updated_at_ms = excluded.updated_at_ms`,
        )
        .bind(command.customerId, ledgerEntryId, command.nowMs),
    ]);
    requireChanges(results, [1, 1, 1]);
    return {
      balance: await this.getBalance(command.customerId, command.nowMs),
      idempotent: false,
    };
  }

  async openUsageSession(params: {
    customerId: string;
    generation: number;
    nowMs: number;
    usageSessionId: string;
  }): Promise<{ balance: LedgerBalance; generation: number; usageSessionId: string }> {
    await this.requireActiveCustomer(params.customerId);
    const balance = await this.getBalance(params.customerId, params.nowMs);
    if (balance.availableMs <= 0) {
      throw new AllowanceExhaustedError(balance.availableMs);
    }
    const existing = await this.database
      .prepare(
        `SELECT customer_id, generation, state
         FROM usage_sessions
         WHERE usage_session_id = ?`,
      )
      .bind(params.usageSessionId)
      .first<UsageSessionRow>();
    if (existing) {
      if (existing.customer_id !== params.customerId || existing.state !== "open") {
        throw new UsageSessionClosedError();
      }
      return {
        balance,
        generation: existing.generation,
        usageSessionId: params.usageSessionId,
      };
    }

    await this.database
      .prepare(
        `UPDATE usage_sessions
         SET state = 'failed', ended_at_ms = ?, updated_at_ms = ?
         WHERE customer_id = ? AND state = 'open' AND usage_session_id != ?`,
      )
      .bind(params.nowMs, params.nowMs, params.customerId, params.usageSessionId)
      .run();
    const result = await this.database
      .prepare(
        `INSERT INTO usage_sessions
          (usage_session_id, customer_id, generation, state, forwarded_ms, settled_ms,
           next_settlement_sequence, started_at_ms, ended_at_ms, updated_at_ms)
         VALUES (?, ?, ?, 'open', 0, 0, 1, ?, NULL, ?)`,
      )
      .bind(
        params.usageSessionId,
        params.customerId,
        params.generation,
        params.nowMs,
        params.nowMs,
      )
      .run();
    requireChanges([result], [1]);
    return { balance, generation: params.generation, usageSessionId: params.usageSessionId };
  }

  async closeUsageSession(command: CloseUsageSessionCommand): Promise<{
    idempotent: boolean;
    usageSessionId: string;
  }> {
    const session = await this.database
      .prepare(
        `SELECT customer_id, generation, state
         FROM usage_sessions
         WHERE usage_session_id = ?`,
      )
      .bind(command.usageSessionId)
      .first<UsageSessionRow>();
    if (!session || session.customer_id !== command.customerId) {
      throw new UsageSessionClosedError();
    }
    if (session.state !== "open") {
      return { idempotent: true, usageSessionId: command.usageSessionId };
    }
    const result = await this.database
      .prepare(
        `UPDATE usage_sessions
         SET state = ?, ended_at_ms = ?, updated_at_ms = ?
         WHERE usage_session_id = ? AND customer_id = ? AND state = 'open'`,
      )
      .bind(
        command.outcome,
        command.nowMs,
        command.nowMs,
        command.usageSessionId,
        command.customerId,
      )
      .run();
    requireChanges([result], [1]);
    return { idempotent: false, usageSessionId: command.usageSessionId };
  }

  async settleUsage(command: SettleUsageCommand): Promise<{
    allocations: GrantDebit[];
    balance: LedgerBalance;
    idempotent: boolean;
  }> {
    const existingSettlement = await this.database
      .prepare(
        `SELECT amount_ms
         FROM usage_settlements
         WHERE usage_session_id = ? AND settlement_sequence = ?`,
      )
      .bind(command.usageSessionId, command.settlementSequence)
      .first<UsageSettlementRow>();
    if (existingSettlement) {
      if (existingSettlement.amount_ms !== command.amountMs) {
        throw new Error("settlement idempotency conflict");
      }
      return {
        allocations: [],
        balance: await this.getBalance(command.customerId, command.nowMs),
        idempotent: true,
      };
    }

    const session = await this.database
      .prepare(
        `SELECT customer_id, generation, state
         FROM usage_sessions
         WHERE usage_session_id = ?`,
      )
      .bind(command.usageSessionId)
      .first<UsageSessionRow>();
    if (!session || session.customer_id !== command.customerId || session.state !== "open") {
      throw new UsageSessionClosedError();
    }
    const balance = await this.getBalance(command.customerId, command.nowMs);
    if (balance.availableMs < command.amountMs) {
      throw new AllowanceExhaustedError(balance.availableMs);
    }

    const result = await this.database
      .prepare(
        `SELECT grant_id, remaining_ms, expires_at_ms, created_at_ms, original_ms
         FROM balance_grants
         WHERE customer_id = ?
           AND remaining_ms > 0
           AND state = 'available'
           AND (expires_at_ms IS NULL OR expires_at_ms > ?)
           AND (
             grant_kind != 'free'
             OR NOT EXISTS (
               SELECT 1
               FROM subscriptions
               WHERE customer_id = ?
                 AND state IN ('active', 'grace', 'billing_retry')
                 AND paid_through_ms > ?
             )
           )`,
      )
      .bind(command.customerId, command.nowMs, command.customerId, command.nowMs)
      .all<GrantRow>();
    const grants: SpendableGrant[] = result.results.map((grant) => ({
      createdAtMs: grant.created_at_ms,
      expiresAtMs: grant.expires_at_ms,
      grantId: grant.grant_id,
      remainingMs: grant.remaining_ms,
    }));
    const allocation = allocateDebit(grants, command.amountMs, command.nowMs);
    if (!allocation.ok) {
      throw new AllowanceExhaustedError(allocation.availableMs);
    }

    const ledgerEntryId =
      `ledger:usage:${command.usageSessionId}:${command.settlementSequence}`;
    const statements: D1PreparedStatement[] = [
      this.database
        .prepare(
          `INSERT INTO ledger_entries
            (ledger_entry_id, customer_id, entry_kind, amount_ms, idempotency_key, grant_id,
             usage_session_id, store_transaction_row_id, store_event_row_id,
             reverses_ledger_entry_id, metadata_json, created_at_ms)
           VALUES (?, ?, 'debit', ?, ?, NULL, ?, NULL, NULL, NULL, ?, ?)`,
        )
        .bind(
          ledgerEntryId,
          command.customerId,
          -command.amountMs,
          `usage:${command.usageSessionId}:${command.settlementSequence}`,
          command.usageSessionId,
          JSON.stringify({ allocations: allocation.allocations }),
          command.nowMs,
        ),
    ];
    for (const debit of allocation.allocations) {
      statements.push(
        this.database
          .prepare(
            `UPDATE balance_grants
             SET remaining_ms = remaining_ms - ?,
                 state = CASE WHEN remaining_ms - ? = 0 THEN 'exhausted' ELSE state END,
                 updated_at_ms = ?
             WHERE grant_id = ? AND remaining_ms >= ? AND state = 'available'`,
          )
          .bind(debit.amountMs, debit.amountMs, command.nowMs, debit.grantId, debit.amountMs),
      );
    }
    statements.push(
      this.database
        .prepare(
          `INSERT INTO usage_settlements
            (usage_session_id, settlement_sequence, amount_ms, ledger_entry_id, created_at_ms)
           VALUES (?, ?, ?, ?, ?)`,
        )
        .bind(
          command.usageSessionId,
          command.settlementSequence,
          command.amountMs,
          ledgerEntryId,
          command.nowMs,
        ),
      this.database
        .prepare(
          `UPDATE usage_sessions
           SET forwarded_ms = forwarded_ms + ?,
               settled_ms = settled_ms + ?,
               next_settlement_sequence = ?,
               updated_at_ms = ?
           WHERE usage_session_id = ?
             AND customer_id = ?
             AND state = 'open'
             AND next_settlement_sequence = ?`,
        )
        .bind(
          command.amountMs,
          command.amountMs,
          command.settlementSequence + 1,
          command.nowMs,
          command.usageSessionId,
          command.customerId,
          command.settlementSequence,
        ),
      this.updateProjectionVersion(command.customerId, ledgerEntryId, command.nowMs),
    );
    const batchResults = await this.database.batch(statements);
    requireChanges(batchResults, statements.map(() => 1));
    return {
      allocations: allocation.allocations,
      balance: await this.getBalance(command.customerId, command.nowMs),
      idempotent: false,
    };
  }

  async reverseGrant(command: ReverseGrantCommand): Promise<{
    balance: LedgerBalance;
    idempotent: boolean;
  }> {
    const existing = await this.database
      .prepare(
        `SELECT reversed_ms
         FROM refund_reversals
         WHERE refund_event_id = ? AND grant_id = ?`,
      )
      .bind(command.refundEventId, command.grantId)
      .first<RefundReversalRow>();
    if (existing) {
      return {
        balance: await this.getBalance(command.customerId, command.nowMs),
        idempotent: true,
      };
    }

    const grant = await this.database
      .prepare(
        `SELECT grant_id, original_ms, remaining_ms, expires_at_ms, created_at_ms
         FROM balance_grants
         WHERE grant_id = ? AND customer_id = ?`,
      )
      .bind(command.grantId, command.customerId)
      .first<GrantRow>();
    if (!grant) {
      throw new Error("grant not found");
    }
    const ledgerEntryId = `ledger:refund:${command.refundEventId}:${command.grantId}`;
    const results = await this.database.batch([
      this.database
        .prepare(
          `INSERT INTO ledger_entries
            (ledger_entry_id, customer_id, entry_kind, amount_ms, idempotency_key, grant_id,
             usage_session_id, store_transaction_row_id, store_event_row_id,
             reverses_ledger_entry_id, metadata_json, created_at_ms)
           VALUES (?, ?, 'refund_reversal', ?, ?, ?, NULL, NULL, ?, NULL, ?, ?)`,
        )
        .bind(
          ledgerEntryId,
          command.customerId,
          -grant.original_ms,
          `refund:${command.refundEventId}:${command.grantId}`,
          command.grantId,
          command.storeEventRowId,
          JSON.stringify({ refund_event_id: command.refundEventId }),
          command.nowMs,
        ),
      this.database
        .prepare(
          `UPDATE balance_grants
           SET remaining_ms = remaining_ms - original_ms,
               state = 'reversed',
               updated_at_ms = ?
           WHERE grant_id = ? AND customer_id = ?`,
        )
        .bind(command.nowMs, command.grantId, command.customerId),
      this.database
        .prepare(
          `INSERT INTO refund_reversals
            (refund_event_id, grant_id, ledger_entry_id, reversed_ms, created_at_ms)
           VALUES (?, ?, ?, ?, ?)`,
        )
        .bind(
          command.refundEventId,
          command.grantId,
          ledgerEntryId,
          grant.original_ms,
          command.nowMs,
        ),
      this.database
        .prepare(
          `UPDATE projection_versions
           SET version = version + 1,
               last_ledger_entry_id = ?,
               updated_at_ms = ?
           WHERE customer_id = ?`,
        )
        .bind(ledgerEntryId, command.nowMs, command.customerId),
    ]);
    requireChanges(results, [1, 1, 1, 1]);
    return {
      balance: await this.getBalance(command.customerId, command.nowMs),
      idempotent: false,
    };
  }

  async restoreGrant(command: RestoreGrantCommand): Promise<{
    balance: LedgerBalance;
    idempotent: boolean;
  }> {
    const existing = await this.database
      .prepare(
        `SELECT restored_ms
         FROM refund_restorations
         WHERE refund_event_id = ? AND grant_id = ?`,
      )
      .bind(command.originalRefundEventId, command.grantId)
      .first<{ restored_ms: number }>();
    if (existing) {
      return {
        balance: await this.getBalance(command.customerId, command.nowMs),
        idempotent: true,
      };
    }
    const reversal = await this.database
      .prepare(
        `SELECT reversed_ms, ledger_entry_id
         FROM refund_reversals
         WHERE refund_event_id = ? AND grant_id = ?`,
      )
      .bind(command.originalRefundEventId, command.grantId)
      .first<{ ledger_entry_id: string; reversed_ms: number }>();
    if (!reversal) {
      throw new Error("refund reversal not found");
    }
    const ledgerEntryId =
      `ledger:refund-restored:${command.restorationEventId}:${command.grantId}`;
    const results = await this.database.batch([
      this.database
        .prepare(
          `INSERT INTO ledger_entries
            (ledger_entry_id, customer_id, entry_kind, amount_ms, idempotency_key, grant_id,
             usage_session_id, store_transaction_row_id, store_event_row_id,
             reverses_ledger_entry_id, metadata_json, created_at_ms)
           VALUES (?, ?, 'refund_restoration', ?, ?, ?, NULL, NULL, ?, ?, ?, ?)`,
        )
        .bind(
          ledgerEntryId,
          command.customerId,
          reversal.reversed_ms,
          `refund-restored:${command.restorationEventId}:${command.grantId}`,
          command.grantId,
          command.storeEventRowId,
          reversal.ledger_entry_id,
          JSON.stringify({
            original_refund_event_id: command.originalRefundEventId,
            restoration_event_id: command.restorationEventId,
          }),
          command.nowMs,
        ),
      this.database
        .prepare(
          `UPDATE balance_grants
           SET remaining_ms = remaining_ms + ?,
               state = CASE WHEN remaining_ms + ? > 0 THEN 'available' ELSE 'exhausted' END,
               updated_at_ms = ?
           WHERE grant_id = ? AND customer_id = ? AND state = 'reversed'`,
        )
        .bind(
          reversal.reversed_ms,
          reversal.reversed_ms,
          command.nowMs,
          command.grantId,
          command.customerId,
        ),
      this.database
        .prepare(
          `INSERT INTO refund_restorations
            (refund_event_id, grant_id, ledger_entry_id, restored_ms, created_at_ms)
           VALUES (?, ?, ?, ?, ?)`,
        )
        .bind(
          command.originalRefundEventId,
          command.grantId,
          ledgerEntryId,
          reversal.reversed_ms,
          command.nowMs,
        ),
      this.updateProjectionVersion(command.customerId, ledgerEntryId, command.nowMs),
    ]);
    requireChanges(results, [1, 1, 1, 1]);
    return {
      balance: await this.getBalance(command.customerId, command.nowMs),
      idempotent: false,
    };
  }

  private async getCustomer(customerId: string): Promise<CustomerRow | null> {
    return this.database
      .prepare("SELECT customer_id, state FROM customers WHERE customer_id = ?")
      .bind(customerId)
      .first<CustomerRow>();
  }

  private async requireActiveCustomer(customerId: string): Promise<void> {
    const customer = await this.getCustomer(customerId);
    if (!customer || customer.state !== "active") {
      throw new CustomerDeletedError();
    }
  }

  private updateProjectionVersion(
    customerId: string,
    ledgerEntryId: string,
    nowMs: number,
  ): D1PreparedStatement {
    return this.database
      .prepare(
        `UPDATE projection_versions
         SET version = version + 1, last_ledger_entry_id = ?, updated_at_ms = ?
         WHERE customer_id = ?`,
      )
      .bind(ledgerEntryId, nowMs, customerId);
  }
}

function balanceFromRow(row: BalanceRow): LedgerBalance {
  return {
    allowanceMs: row.allowance_ms,
    availableMs: row.available_ms,
    creditMs: row.credit_ms,
    earliestExpiryAtMs: row.earliest_expiry_at_ms,
    negativeMs: row.negative_ms,
  };
}

function requireChanges(results: readonly D1Result[], expected: readonly number[]): void {
  for (const [index, count] of expected.entries()) {
    if (results[index]?.meta.changes !== count) {
      throw new Error(`ledger batch statement ${index} changed an unexpected row count`);
    }
  }
}

export class AllowanceExhaustedError extends Error {
  constructor(readonly availableMs: number) {
    super("allowance exhausted");
  }
}

export class CustomerDeletedError extends Error {}
export class CustomerMismatchError extends Error {}
export class UsageSessionClosedError extends Error {}
