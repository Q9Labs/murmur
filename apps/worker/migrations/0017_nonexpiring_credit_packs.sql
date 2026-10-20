INSERT INTO schema_migrations (version, name, applied_at_ms)
VALUES (17, 'nonexpiring_credit_packs', unixepoch('subsec') * 1000);

UPDATE store_transactions
SET expires_at_ms = NULL
WHERE product_kind = 'credit_pack';

UPDATE balance_grants
SET expires_at_ms = NULL,
    state = CASE WHEN state = 'expired' AND remaining_ms > 0 THEN 'available' ELSE state END
WHERE grant_kind = 'credit_pack';
