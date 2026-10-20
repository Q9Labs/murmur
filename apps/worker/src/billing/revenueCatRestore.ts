import type { RevenueCatVerifiedResource } from "./revenueCatApi";

export async function restoreVerifiedResourceOwnership(params: {
  customerId: string;
  database: D1Database;
  nowMs: number;
  resource: RevenueCatVerifiedResource;
  resourceKey: string;
}): Promise<void> {
  const { customerId, database, nowMs, resource } = params;
  const subscription = "episodeId" in resource;
  const identity = subscription ? resource.storeSubscriptionId : resource.storeTransactionId;
  const transactions = `SELECT store_transaction_row_id FROM store_transactions
    WHERE provider = ? AND environment = ? AND ${subscription ? "original_transaction_id" : "transaction_id"} = ?`;
  const prefix = subscription ? `pro:${resource.episodeId}:` : "";
  const grants = subscription
    ? "grant_kind = 'pro' AND substr(grant_key, 1, length(?)) = ?"
    : `source_transaction_row_id IN (${transactions})`;
  const grantBindings = subscription
    ? [prefix, prefix]
    : [resource.provider, resource.environment, identity];
  const transferId = `restore:${crypto.randomUUID()}`;
  const statements = [-1, 1].map((direction) => database.prepare(
    `INSERT INTO ledger_entries
      (ledger_entry_id, customer_id, entry_kind, amount_ms, idempotency_key,
       grant_id, metadata_json, created_at_ms)
     SELECT ? || grant_id, ${direction === 1 ? "?" : "customer_id"}, 'merge',
       remaining_ms * ?, ? || grant_id, grant_id, '{"restore":true}', ?
     FROM balance_grants WHERE ${grants} AND customer_id != ? AND remaining_ms != 0`,
  ).bind(
    `${transferId}:${direction}:`,
    ...(direction === 1 ? [customerId] : []),
    direction, `${transferId}:${direction}:`, nowMs, ...grantBindings, customerId,
  ));
  statements.unshift(database.prepare(
    `UPDATE usage_sessions SET state = 'failed', ended_at_ms = ?, updated_at_ms = ?
     WHERE state = 'open' AND customer_id IN (
       SELECT customer_id FROM balance_grants WHERE ${grants} AND customer_id != ?
     )`,
  ).bind(nowMs, nowMs, ...grantBindings, customerId));
  statements.push(database.prepare(
    `INSERT INTO projection_versions (customer_id, version, updated_at_ms)
     SELECT customer_id, 1, ? FROM balance_grants
     WHERE ${grants} AND customer_id != ? GROUP BY customer_id
     ON CONFLICT(customer_id) DO UPDATE SET version = version + 1, updated_at_ms = excluded.updated_at_ms`,
  ).bind(nowMs, ...grantBindings, customerId));
  statements.push(database.prepare(
    `INSERT INTO projection_versions (customer_id, version, updated_at_ms)
     VALUES (?, 1, ?)
     ON CONFLICT(customer_id) DO UPDATE SET version = version + 1, updated_at_ms = excluded.updated_at_ms`,
  ).bind(customerId, nowMs));
  statements.push(database.prepare(
    `UPDATE balance_grants SET customer_id = ?, updated_at_ms = ?
     WHERE ${grants} AND customer_id != ?`,
  ).bind(customerId, nowMs, ...grantBindings, customerId));
  statements.push(database.prepare(
    `UPDATE store_transactions SET customer_id = ?, updated_at_ms = MAX(updated_at_ms, ?)
     WHERE store_transaction_row_id IN (${transactions})`,
  ).bind(customerId, nowMs, resource.provider, resource.environment, identity));
  if (subscription) {
    statements.push(database.prepare(
      `UPDATE subscriptions SET customer_id = ?, updated_at_ms = MAX(updated_at_ms, ?)
       WHERE provider = ? AND environment = ? AND episode_id = ?`,
    ).bind(customerId, nowMs, resource.provider, resource.environment, resource.episodeId));
    statements.push(database.prepare(
      `UPDATE allowance_periods SET customer_id = ?
       WHERE allowance_kind = 'pro' AND substr(period_key, 1, length(?)) = ? AND customer_id != ?`,
    ).bind(customerId, prefix, prefix, customerId));
  }
  statements.push(database.prepare(
    "UPDATE reconciliation_resource_states SET customer_id = ?, updated_at_ms = ? WHERE resource_key = ?",
  ).bind(customerId, nowMs, params.resourceKey));
  await database.batch(statements);
}
