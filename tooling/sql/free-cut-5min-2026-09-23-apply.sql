-- One-off D1 import. Wrangler's remote --file import rolls back the whole file on failure.
-- cspell:ignore strftime
-- The recut retains already-used minutes: both original_ms and remaining_ms fall by cut_ms.
-- An immutable release ledger entry records each change, as in the 10-minute recut.
-- Its metadata grant_key is the recut key.
-- D1 rejects temporary tables, so the ledger entries written first identify the targets
-- for the later statements. Re-running the file changes nothing.
INSERT INTO ledger_entries
  (ledger_entry_id, customer_id, entry_kind, amount_ms, idempotency_key, grant_id,
   usage_session_id, store_transaction_row_id, store_event_row_id,
   reverses_ledger_entry_id, metadata_json, created_at_ms)
SELECT 'ledger:free-cut-5min-2026-09-23:' || grant_id, customer_id, 'release',
       -(remaining_ms - 300000), 'free-cut-5min-2026-09-23:' || grant_id, grant_id,
       NULL, NULL, NULL, NULL,
       json_object('grant_key', 'free-cut-5min-2026-09-23',
                   'source_grant_id', grant_id, 'cut_ms', remaining_ms - 300000),
       CAST(strftime('%s', 'now') AS INTEGER) * 1000
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

UPDATE projection_versions
SET version = version + (
      SELECT COUNT(*) FROM ledger_entries AS recut
      JOIN balance_grants AS cut_grant ON cut_grant.grant_id = recut.grant_id
      WHERE recut.customer_id = projection_versions.customer_id
        AND recut.idempotency_key LIKE 'free-cut-5min-2026-09-23:%'
        AND cut_grant.remaining_ms > 300000
    ),
    last_ledger_entry_id = (
      SELECT recut.ledger_entry_id FROM ledger_entries AS recut
      JOIN balance_grants AS cut_grant ON cut_grant.grant_id = recut.grant_id
      WHERE recut.customer_id = projection_versions.customer_id
        AND recut.idempotency_key LIKE 'free-cut-5min-2026-09-23:%'
        AND cut_grant.remaining_ms > 300000
      ORDER BY recut.ledger_entry_id DESC LIMIT 1
    ),
    updated_at_ms = CAST(strftime('%s', 'now') AS INTEGER) * 1000
WHERE customer_id IN (
  SELECT recut.customer_id FROM ledger_entries AS recut
  JOIN balance_grants AS cut_grant ON cut_grant.grant_id = recut.grant_id
  WHERE recut.idempotency_key LIKE 'free-cut-5min-2026-09-23:%'
    AND cut_grant.remaining_ms > 300000
);

UPDATE balance_grants
SET original_ms = original_ms + (
      SELECT amount_ms FROM ledger_entries
      WHERE idempotency_key = 'free-cut-5min-2026-09-23:' || balance_grants.grant_id
    ),
    remaining_ms = 300000,
    updated_at_ms = CAST(strftime('%s', 'now') AS INTEGER) * 1000
WHERE remaining_ms > 300000
  AND grant_id IN (
    SELECT grant_id FROM ledger_entries
    WHERE idempotency_key LIKE 'free-cut-5min-2026-09-23:%'
  );
