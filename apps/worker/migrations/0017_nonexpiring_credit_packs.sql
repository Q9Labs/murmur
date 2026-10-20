INSERT INTO schema_migrations (version, name, applied_at_ms)
VALUES (17, 'nonexpiring_credit_packs', unixepoch('subsec') * 1000);

UPDATE store_transactions
SET expires_at_ms = NULL
WHERE product_kind = 'credit_pack';

UPDATE balance_grants
SET expires_at_ms = NULL,
    state = CASE WHEN state = 'expired' AND remaining_ms > 0 THEN 'available' ELSE state END
WHERE grant_kind = 'credit_pack';

CREATE TRIGGER credit_pack_transaction_insert_never_expires
AFTER INSERT ON store_transactions WHEN NEW.product_kind = 'credit_pack' AND NEW.expires_at_ms IS NOT NULL
BEGIN
  UPDATE store_transactions SET expires_at_ms = NULL WHERE store_transaction_row_id = NEW.store_transaction_row_id;
END;

CREATE TRIGGER credit_pack_transaction_update_never_expires
AFTER UPDATE OF expires_at_ms, product_kind ON store_transactions
WHEN NEW.product_kind = 'credit_pack' AND NEW.expires_at_ms IS NOT NULL
BEGIN
  UPDATE store_transactions SET expires_at_ms = NULL WHERE store_transaction_row_id = NEW.store_transaction_row_id;
END;

CREATE TRIGGER credit_pack_grant_insert_never_expires
AFTER INSERT ON balance_grants
WHEN NEW.grant_kind = 'credit_pack' AND (NEW.expires_at_ms IS NOT NULL OR (NEW.state = 'expired' AND NEW.remaining_ms > 0))
BEGIN
  UPDATE balance_grants SET expires_at_ms = NULL,
    state = CASE WHEN state = 'expired' AND remaining_ms > 0 THEN 'available' ELSE state END
  WHERE grant_id = NEW.grant_id;
END;

CREATE TRIGGER credit_pack_grant_update_never_expires
AFTER UPDATE OF expires_at_ms, grant_kind, state ON balance_grants
WHEN NEW.grant_kind = 'credit_pack' AND (NEW.expires_at_ms IS NOT NULL OR (NEW.state = 'expired' AND NEW.remaining_ms > 0))
BEGIN
  UPDATE balance_grants SET expires_at_ms = NULL,
    state = CASE WHEN state = 'expired' AND remaining_ms > 0 THEN 'available' ELSE state END
  WHERE grant_id = NEW.grant_id;
END;
