INSERT INTO schema_migrations (version, name, applied_at_ms)
VALUES (9, 'credit_pack_expiry', unixepoch('subsec') * 1000);

UPDATE store_transactions
SET expires_at_ms = purchased_at_ms + 7776000000
WHERE product_kind = 'credit_pack'
  AND expires_at_ms IS NULL;

UPDATE balance_grants
SET expires_at_ms = valid_from_ms + 7776000000
WHERE grant_kind = 'credit_pack'
  AND expires_at_ms IS NULL;
