/// <reference types="@cloudflare/workers-types" />

import { mergedFreeRemainingMs } from "./accountMerge";

type CustomerRow = { state: string };
type GrantRow = {
  grant_id: string;
  original_ms: number;
  remaining_ms: number;
};
type PaidValueRow = { paid_grant_count: number };

export async function mergeGuestCustomer(params: {
  database: D1Database | undefined;
  destinationCustomerId: string;
  nowMs: number;
  sourceCustomerId: string;
}): Promise<void> {
  const database = params.database;
  if (!database) {
    throw new Error("billing database is unavailable during account merge");
  }
  if (params.sourceCustomerId === params.destinationCustomerId) {
    return;
  }
  const existingAlias = await database
    .prepare("SELECT canonical_customer_id FROM customer_aliases WHERE alias_customer_id = ?")
    .bind(params.sourceCustomerId)
    .first<{ canonical_customer_id: string }>();
  if (existingAlias) {
    if (existingAlias.canonical_customer_id !== params.destinationCustomerId) {
      throw new Error("guest account is already linked to a different customer");
    }
    return;
  }
  const [sourceCustomer, destinationCustomer, paidValue] = await Promise.all([
    database
      .prepare("SELECT state FROM customers WHERE customer_id = ?")
      .bind(params.sourceCustomerId)
      .first<CustomerRow>(),
    database
      .prepare("SELECT state FROM customers WHERE customer_id = ?")
      .bind(params.destinationCustomerId)
      .first<CustomerRow>(),
    database
      .prepare(
        `SELECT COUNT(*) AS paid_grant_count
         FROM balance_grants
         WHERE customer_id = ? AND grant_kind != 'free' AND remaining_ms != 0`,
      )
      .bind(params.sourceCustomerId)
      .first<PaidValueRow>(),
  ]);
  if (sourceCustomer?.state !== "active" || destinationCustomer?.state !== "active") {
    throw new Error("account merge requires two active customers");
  }
  if ((paidValue?.paid_grant_count ?? 0) > 0) {
    throw new Error("guest account with paid value requires audited support merge");
  }

  const periodPrefix = currentFreePeriodPrefix(params.nowMs);
  const [sourceGrant, destinationGrant] = await Promise.all([
    currentFreeGrant(database, params.sourceCustomerId, periodPrefix),
    currentFreeGrant(database, params.destinationCustomerId, periodPrefix),
  ]);
  if (!sourceGrant || !destinationGrant) {
    throw new Error("account merge could not find the current free allowance");
  }
  const destinationRemainingMs = mergedFreeRemainingMs({
    destinationOriginalMs: destinationGrant.original_ms,
    destinationRemainingMs: destinationGrant.remaining_ms,
    sourceOriginalMs: sourceGrant.original_ms,
    sourceRemainingMs: sourceGrant.remaining_ms,
  });
  const destinationDeltaMs = destinationRemainingMs - destinationGrant.remaining_ms;
  const mergeId = `merge:${params.sourceCustomerId}:${params.destinationCustomerId}`;
  const statements: D1PreparedStatement[] = [
    database
      .prepare(
        `INSERT INTO customer_merges
          (merge_id, source_customer_id, destination_customer_id, state, created_at_ms, completed_at_ms)
         VALUES (?, ?, ?, 'pending', ?, NULL)`,
      )
      .bind(
        mergeId,
        params.sourceCustomerId,
        params.destinationCustomerId,
        params.nowMs,
      ),
  ];
  if (sourceGrant.remaining_ms > 0) {
    statements.push(
      mergeLedgerEntry({
        amountMs: -sourceGrant.remaining_ms,
        customerId: params.sourceCustomerId,
        database,
        grantId: sourceGrant.grant_id,
        idempotencyKey: `${mergeId}:source-free`,
        ledgerEntryId: `ledger:${mergeId}:source-free`,
        nowMs: params.nowMs,
        sourceCustomerId: params.sourceCustomerId,
      }),
      database
        .prepare(
          `UPDATE balance_grants
           SET remaining_ms = 0, state = 'exhausted', updated_at_ms = ?
           WHERE grant_id = ? AND customer_id = ?`,
        )
        .bind(params.nowMs, sourceGrant.grant_id, params.sourceCustomerId),
      updateProjection(
        database,
        params.sourceCustomerId,
        `ledger:${mergeId}:source-free`,
        params.nowMs,
      ),
    );
  }
  if (destinationDeltaMs !== 0) {
    statements.push(
      mergeLedgerEntry({
        amountMs: destinationDeltaMs,
        customerId: params.destinationCustomerId,
        database,
        grantId: destinationGrant.grant_id,
        idempotencyKey: `${mergeId}:destination-free`,
        ledgerEntryId: `ledger:${mergeId}:destination-free`,
        nowMs: params.nowMs,
        sourceCustomerId: params.sourceCustomerId,
      }),
      database
        .prepare(
          `UPDATE balance_grants
           SET remaining_ms = ?, state = ?, updated_at_ms = ?
           WHERE grant_id = ? AND customer_id = ?`,
        )
        .bind(
          destinationRemainingMs,
          destinationRemainingMs > 0 ? "available" : "exhausted",
          params.nowMs,
          destinationGrant.grant_id,
          params.destinationCustomerId,
        ),
      updateProjection(
        database,
        params.destinationCustomerId,
        `ledger:${mergeId}:destination-free`,
        params.nowMs,
      ),
    );
  }
  statements.push(
    database
      .prepare(
        `UPDATE usage_sessions
         SET state = 'failed', ended_at_ms = ?, updated_at_ms = ?
         WHERE customer_id = ? AND state = 'open'`,
      )
      .bind(params.nowMs, params.nowMs, params.sourceCustomerId),
    database
      .prepare(
        `UPDATE customer_principals
         SET revoked_at_ms = COALESCE(revoked_at_ms, ?)
         WHERE customer_id = ?`,
      )
      .bind(params.nowMs, params.sourceCustomerId),
    database
      .prepare(
        `INSERT INTO customer_aliases (alias_customer_id, canonical_customer_id, merged_at_ms)
         VALUES (?, ?, ?)`,
      )
      .bind(params.sourceCustomerId, params.destinationCustomerId, params.nowMs),
    database
      .prepare(
        `UPDATE customers
         SET state = 'deleted', deleted_at_ms = ?, updated_at_ms = ?
         WHERE customer_id = ? AND state = 'active'`,
      )
      .bind(params.nowMs, params.nowMs, params.sourceCustomerId),
    database
      .prepare(
        `UPDATE customer_merges
         SET state = 'committed', completed_at_ms = ?
         WHERE merge_id = ? AND state = 'pending'`,
      )
      .bind(params.nowMs, mergeId),
  );
  await database.batch(statements);
}

async function currentFreeGrant(
  database: D1Database,
  customerId: string,
  periodPrefix: string,
): Promise<GrantRow | null> {
  return database
    .prepare(
      `SELECT grant_id, original_ms, remaining_ms
       FROM balance_grants
       WHERE customer_id = ? AND grant_kind = 'free' AND grant_key = ?`,
    )
    .bind(customerId, periodPrefix)
    .first<GrantRow>();
}

function currentFreePeriodPrefix(nowMs: number): string {
  const now = new Date(nowMs);
  return `free:${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

function mergeLedgerEntry(params: {
  amountMs: number;
  customerId: string;
  database: D1Database;
  grantId: string;
  idempotencyKey: string;
  ledgerEntryId: string;
  nowMs: number;
  sourceCustomerId: string;
}): D1PreparedStatement {
  return params.database
    .prepare(
      `INSERT INTO ledger_entries
        (ledger_entry_id, customer_id, entry_kind, amount_ms, idempotency_key, grant_id,
         usage_session_id, store_transaction_row_id, store_event_row_id,
         reverses_ledger_entry_id, metadata_json, created_at_ms)
       VALUES (?, ?, 'merge', ?, ?, ?, NULL, NULL, NULL, NULL, ?, ?)`,
    )
    .bind(
      params.ledgerEntryId,
      params.customerId,
      params.amountMs,
      params.idempotencyKey,
      params.grantId,
      JSON.stringify({ source_customer_id: params.sourceCustomerId }),
      params.nowMs,
    );
}

function updateProjection(
  database: D1Database,
  customerId: string,
  ledgerEntryId: string,
  nowMs: number,
): D1PreparedStatement {
  return database
    .prepare(
      `INSERT INTO projection_versions
        (customer_id, version, last_ledger_entry_id, rebuilt_at_ms, updated_at_ms)
       VALUES (?, 1, ?, NULL, ?)
       ON CONFLICT(customer_id) DO UPDATE SET
         version = projection_versions.version + 1,
         last_ledger_entry_id = excluded.last_ledger_entry_id,
         updated_at_ms = excluded.updated_at_ms`,
    )
    .bind(customerId, ledgerEntryId, nowMs);
}
