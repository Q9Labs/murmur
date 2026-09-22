-- Read-only preview for the five-minute Free recut. Execute before the apply file.
-- cspell:ignore strftime
WITH targets AS (
  SELECT customer_id, grant_id, remaining_ms - 300000 AS cut_ms
  FROM balance_grants AS grant_row
  WHERE grant_kind = 'free'
    AND grant_key NOT LIKE 'free-cut-%'
    AND state = 'available'
    AND remaining_ms > 300000
    AND expires_at_ms > CAST(strftime('%s', 'now') AS INTEGER) * 1000
    AND NOT EXISTS (
      SELECT 1 FROM ledger_entries
      WHERE idempotency_key = 'free-cut-5min-2026-09-23:' || grant_row.grant_id
    )
)
SELECT COUNT(DISTINCT customer_id) AS affected_customers,
       COUNT(*) AS affected_grants,
       COALESCE(SUM(cut_ms), 0) / 60000.0 AS minutes_to_remove
FROM targets;
