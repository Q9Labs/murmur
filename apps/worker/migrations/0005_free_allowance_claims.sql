PRAGMA foreign_keys = ON;

INSERT INTO schema_migrations (version, name, applied_at_ms)
VALUES (5, 'free_allowance_claims', unixepoch('subsec') * 1000);

CREATE TABLE free_allowance_claims (
  claim_hash TEXT NOT NULL,
  period_key TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  claimed_at_ms INTEGER NOT NULL,
  expires_at_ms INTEGER NOT NULL,
  PRIMARY KEY (claim_hash, period_key)
) WITHOUT ROWID, STRICT;

CREATE INDEX free_allowance_claims_expiry_idx
ON free_allowance_claims (expires_at_ms);
