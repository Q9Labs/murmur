INSERT INTO schema_migrations (version, name, applied_at_ms)
VALUES (8, 'personal_offers', unixepoch('subsec') * 1000);

CREATE TABLE personal_offers (
  customer_id TEXT PRIMARY KEY REFERENCES customers(customer_id),
  started_at_ms INTEGER NOT NULL,
  expires_at_ms INTEGER NOT NULL,
  redeemed INTEGER NOT NULL DEFAULT 0 CHECK (redeemed IN (0, 1)),
  CHECK (expires_at_ms > started_at_ms)
) STRICT;
