PRAGMA foreign_keys = OFF;

INSERT INTO schema_migrations (version, name, applied_at_ms)
VALUES (6, 'reconciliation_login_trigger', unixepoch('subsec') * 1000);

CREATE TABLE reconciliation_runs_next (
  reconciliation_run_id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(customer_id),
  trigger_kind TEXT NOT NULL CHECK (trigger_kind IN ('daily', 'login', 'purchase', 'restore')),
  status TEXT NOT NULL CHECK (status IN ('running', 'succeeded', 'failed')),
  subscription_count INTEGER NOT NULL DEFAULT 0 CHECK (subscription_count >= 0),
  purchase_count INTEGER NOT NULL DEFAULT 0 CHECK (purchase_count >= 0),
  failure_code TEXT,
  started_at_ms INTEGER NOT NULL,
  completed_at_ms INTEGER
) STRICT;

INSERT INTO reconciliation_runs_next SELECT * FROM reconciliation_runs;
DROP TABLE reconciliation_runs;
ALTER TABLE reconciliation_runs_next RENAME TO reconciliation_runs;

CREATE INDEX reconciliation_runs_customer_idx
ON reconciliation_runs (customer_id, started_at_ms);

PRAGMA foreign_keys = ON;
