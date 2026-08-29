PRAGMA foreign_keys = ON;

INSERT INTO schema_migrations (version, name, applied_at_ms)
VALUES (3, 'reconciliation', unixepoch('subsec') * 1000);

CREATE TABLE reconciliation_runs (
  reconciliation_run_id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(customer_id),
  trigger_kind TEXT NOT NULL CHECK (trigger_kind IN ('daily', 'purchase', 'restore')),
  status TEXT NOT NULL CHECK (status IN ('running', 'succeeded', 'failed')),
  subscription_count INTEGER NOT NULL DEFAULT 0 CHECK (subscription_count >= 0),
  purchase_count INTEGER NOT NULL DEFAULT 0 CHECK (purchase_count >= 0),
  failure_code TEXT,
  started_at_ms INTEGER NOT NULL,
  completed_at_ms INTEGER
) STRICT;

CREATE INDEX reconciliation_runs_customer_idx
ON reconciliation_runs (customer_id, started_at_ms);

CREATE TABLE reconciliation_cursors (
  job_key TEXT PRIMARY KEY,
  last_customer_id TEXT,
  updated_at_ms INTEGER NOT NULL
) STRICT;
