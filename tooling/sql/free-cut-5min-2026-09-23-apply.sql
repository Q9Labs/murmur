-- One-off D1 import. Wrangler's remote --file import rolls back the whole file on failure.
-- cspell:ignore strftime
-- The recut retains already-used minutes: both original_ms and remaining_ms fall by cut_ms.
-- An immutable release ledger entry records each change, as in the 10-minute recut.
-- Its metadata grant_key is the recut key.
CREATE TEMP TABLE free_cut_5min_targets AS
SELECT customer_id, grant_id, remaining_ms - 300000 AS cut_ms,
       'free-cut-5min-2026-09-23:' || grant_id AS recut_id
FROM balance_grants AS grant_row
WHERE grant_kind = 'free'
  AND grant_key NOT LIKE 'free-cut-%'
  AND state = 'available'
  AND remaining_ms > 300000
  AND expires_at_ms > CAST(strftime('%s', 'now') AS INTEGER) * 1000
  AND NOT EXISTS (
    SELECT 1 FROM ledger_entries
    WHERE idempotency_key = 'free-cut-5min-2026-09-23:' || grant_row.grant_id
  );

INSERT INTO ledger_entries
  (ledger_entry_id, customer_id, entry_kind, amount_ms, idempotency_key, grant_id,
   usage_session_id, store_transaction_row_id, store_event_row_id,
   reverses_ledger_entry_id, metadata_json, created_at_ms)
SELECT 'ledger:' || recut_id, customer_id, 'release', -cut_ms, recut_id, grant_id,
       NULL, NULL, NULL, NULL,
       json_object('grant_key', 'free-cut-5min-2026-09-23',
                   'source_grant_id', grant_id, 'cut_ms', cut_ms),
       CAST(strftime('%s', 'now') AS INTEGER) * 1000
FROM free_cut_5min_targets;

UPDATE balance_grants
SET original_ms = original_ms - (
      SELECT cut_ms FROM free_cut_5min_targets WHERE grant_id = balance_grants.grant_id
    ),
    remaining_ms = 300000,
    updated_at_ms = CAST(strftime('%s', 'now') AS INTEGER) * 1000
WHERE grant_id IN (SELECT grant_id FROM free_cut_5min_targets);

UPDATE projection_versions
SET version = version + (
      SELECT COUNT(*) FROM free_cut_5min_targets
      WHERE customer_id = projection_versions.customer_id
    ),
    last_ledger_entry_id = (
      SELECT 'ledger:' || recut_id FROM free_cut_5min_targets
      WHERE customer_id = projection_versions.customer_id
      ORDER BY recut_id DESC LIMIT 1
    ),
    updated_at_ms = CAST(strftime('%s', 'now') AS INTEGER) * 1000
WHERE customer_id IN (SELECT customer_id FROM free_cut_5min_targets);

DROP TABLE free_cut_5min_targets;
