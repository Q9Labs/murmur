PRAGMA foreign_keys = ON;

CREATE TABLE schema_migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  applied_at_ms INTEGER NOT NULL
) STRICT;

INSERT INTO schema_migrations (version, name, applied_at_ms)
VALUES (1, 'billing_ledger', unixepoch('subsec') * 1000);

CREATE TABLE customers (
  customer_id TEXT PRIMARY KEY,
  state TEXT NOT NULL CHECK (state IN ('active', 'deleting', 'deleted')),
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL,
  deleted_at_ms INTEGER,
  CHECK (
    (state = 'deleted' AND deleted_at_ms IS NOT NULL)
    OR (state != 'deleted' AND deleted_at_ms IS NULL)
  )
) STRICT;

CREATE TABLE customer_principals (
  principal_id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(customer_id),
  provider TEXT NOT NULL CHECK (provider IN ('anonymous', 'apple', 'google', 'email')),
  provider_subject TEXT NOT NULL,
  created_at_ms INTEGER NOT NULL,
  revoked_at_ms INTEGER,
  UNIQUE (provider, provider_subject)
) STRICT;

CREATE INDEX customer_principals_customer_idx
ON customer_principals (customer_id, revoked_at_ms);

CREATE TABLE customer_aliases (
  alias_customer_id TEXT PRIMARY KEY REFERENCES customers(customer_id),
  canonical_customer_id TEXT NOT NULL REFERENCES customers(customer_id),
  merged_at_ms INTEGER NOT NULL,
  CHECK (alias_customer_id != canonical_customer_id)
) STRICT;

CREATE INDEX customer_aliases_canonical_idx
ON customer_aliases (canonical_customer_id);

CREATE TABLE customer_leases (
  customer_id TEXT PRIMARY KEY REFERENCES customers(customer_id),
  owner_id TEXT NOT NULL,
  fence INTEGER NOT NULL CHECK (fence > 0),
  expires_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL
) STRICT;

CREATE TABLE customer_merges (
  merge_id TEXT PRIMARY KEY,
  source_customer_id TEXT NOT NULL REFERENCES customers(customer_id),
  destination_customer_id TEXT NOT NULL REFERENCES customers(customer_id),
  state TEXT NOT NULL CHECK (state IN ('pending', 'committed', 'failed')),
  created_at_ms INTEGER NOT NULL,
  completed_at_ms INTEGER,
  UNIQUE (source_customer_id, destination_customer_id),
  CHECK (source_customer_id != destination_customer_id)
) STRICT;

CREATE TABLE store_events (
  store_event_row_id TEXT PRIMARY KEY,
  provider TEXT NOT NULL CHECK (provider IN ('revenuecat', 'apple', 'google')),
  environment TEXT NOT NULL CHECK (environment IN ('sandbox', 'production')),
  event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  customer_id TEXT REFERENCES customers(customer_id),
  subscription_episode_id TEXT,
  occurred_at_ms INTEGER NOT NULL,
  received_at_ms INTEGER NOT NULL,
  payload_hash TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'applied', 'ignored_stale', 'invalid', 'failed')),
  failure_code TEXT,
  UNIQUE (provider, environment, event_id)
) STRICT;

CREATE INDEX store_events_customer_idx
ON store_events (customer_id, received_at_ms);

CREATE TABLE subscriptions (
  subscription_id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(customer_id),
  provider TEXT NOT NULL CHECK (provider IN ('apple', 'google')),
  environment TEXT NOT NULL CHECK (environment IN ('sandbox', 'production')),
  original_transaction_id TEXT NOT NULL,
  episode_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  state TEXT NOT NULL CHECK (
    state IN ('pending', 'active', 'grace', 'billing_retry', 'on_hold', 'paused', 'expired', 'revoked')
  ),
  started_at_ms INTEGER NOT NULL,
  paid_through_ms INTEGER,
  anchor_at_ms INTEGER NOT NULL,
  provider_updated_at_ms INTEGER NOT NULL,
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL,
  UNIQUE (provider, environment, original_transaction_id),
  UNIQUE (provider, environment, episode_id)
) STRICT;

CREATE INDEX subscriptions_customer_idx
ON subscriptions (customer_id, state, paid_through_ms);

CREATE TABLE subscription_cursors (
  provider TEXT NOT NULL CHECK (provider IN ('revenuecat', 'apple', 'google')),
  environment TEXT NOT NULL CHECK (environment IN ('sandbox', 'production')),
  episode_id TEXT NOT NULL,
  occurred_at_ms INTEGER NOT NULL,
  event_id TEXT NOT NULL,
  lifecycle_rank INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL,
  PRIMARY KEY (provider, environment, episode_id)
) WITHOUT ROWID, STRICT;

CREATE TABLE store_transactions (
  store_transaction_row_id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(customer_id),
  provider TEXT NOT NULL CHECK (provider IN ('apple', 'google')),
  environment TEXT NOT NULL CHECK (environment IN ('sandbox', 'production')),
  transaction_id TEXT NOT NULL,
  original_transaction_id TEXT,
  product_id TEXT NOT NULL,
  product_kind TEXT NOT NULL CHECK (product_kind IN ('subscription', 'credit_pack')),
  status TEXT NOT NULL CHECK (status IN ('purchased', 'refunded', 'revoked')),
  purchased_at_ms INTEGER NOT NULL,
  expires_at_ms INTEGER,
  currency TEXT,
  price_micros INTEGER,
  source_event_id TEXT,
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL,
  UNIQUE (provider, environment, transaction_id)
) STRICT;

CREATE INDEX store_transactions_customer_idx
ON store_transactions (customer_id, purchased_at_ms);

CREATE TABLE allowance_periods (
  allowance_period_id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(customer_id),
  allowance_kind TEXT NOT NULL CHECK (allowance_kind IN ('free', 'pro')),
  period_key TEXT NOT NULL,
  starts_at_ms INTEGER NOT NULL,
  expires_at_ms INTEGER NOT NULL,
  allowance_ms INTEGER NOT NULL CHECK (allowance_ms >= 0),
  created_at_ms INTEGER NOT NULL,
  UNIQUE (customer_id, period_key),
  CHECK (expires_at_ms > starts_at_ms)
) STRICT;

CREATE TABLE ledger_entries (
  ledger_entry_id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(customer_id),
  entry_kind TEXT NOT NULL CHECK (
    entry_kind IN ('grant', 'debit', 'release', 'refund_reversal', 'refund_restoration', 'merge')
  ),
  amount_ms INTEGER NOT NULL CHECK (amount_ms != 0),
  idempotency_key TEXT NOT NULL UNIQUE,
  grant_id TEXT,
  usage_session_id TEXT,
  store_transaction_row_id TEXT REFERENCES store_transactions(store_transaction_row_id),
  store_event_row_id TEXT REFERENCES store_events(store_event_row_id),
  reverses_ledger_entry_id TEXT REFERENCES ledger_entries(ledger_entry_id),
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at_ms INTEGER NOT NULL
) STRICT;

CREATE INDEX ledger_entries_customer_idx
ON ledger_entries (customer_id, created_at_ms, ledger_entry_id);

CREATE TRIGGER ledger_entries_are_immutable_on_update
BEFORE UPDATE ON ledger_entries
BEGIN
  SELECT RAISE(ABORT, 'ledger_entries are immutable');
END;

CREATE TRIGGER ledger_entries_are_immutable_on_delete
BEFORE DELETE ON ledger_entries
BEGIN
  SELECT RAISE(ABORT, 'ledger_entries are immutable');
END;

CREATE TABLE balance_grants (
  grant_id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(customer_id),
  grant_kind TEXT NOT NULL CHECK (grant_kind IN ('free', 'pro', 'credit_pack')),
  grant_key TEXT NOT NULL,
  original_ms INTEGER NOT NULL CHECK (original_ms > 0),
  remaining_ms INTEGER NOT NULL,
  valid_from_ms INTEGER NOT NULL,
  expires_at_ms INTEGER,
  state TEXT NOT NULL CHECK (state IN ('available', 'exhausted', 'expired', 'reversed')),
  source_ledger_entry_id TEXT NOT NULL REFERENCES ledger_entries(ledger_entry_id),
  source_transaction_row_id TEXT REFERENCES store_transactions(store_transaction_row_id),
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL,
  UNIQUE (customer_id, grant_key),
  CHECK (remaining_ms <= original_ms)
) STRICT;

CREATE INDEX balance_grants_spend_idx
ON balance_grants (customer_id, state, expires_at_ms, created_at_ms);

CREATE TABLE usage_sessions (
  usage_session_id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(customer_id),
  generation INTEGER NOT NULL CHECK (generation > 0),
  state TEXT NOT NULL CHECK (state IN ('open', 'closed', 'failed')),
  forwarded_ms INTEGER NOT NULL DEFAULT 0 CHECK (forwarded_ms >= 0),
  settled_ms INTEGER NOT NULL DEFAULT 0 CHECK (settled_ms >= 0),
  next_settlement_sequence INTEGER NOT NULL DEFAULT 1 CHECK (next_settlement_sequence > 0),
  started_at_ms INTEGER NOT NULL,
  ended_at_ms INTEGER,
  updated_at_ms INTEGER NOT NULL,
  CHECK (forwarded_ms >= settled_ms)
) STRICT;

CREATE INDEX usage_sessions_customer_idx
ON usage_sessions (customer_id, started_at_ms);

CREATE TABLE usage_settlements (
  usage_session_id TEXT NOT NULL REFERENCES usage_sessions(usage_session_id),
  settlement_sequence INTEGER NOT NULL CHECK (settlement_sequence > 0),
  amount_ms INTEGER NOT NULL CHECK (amount_ms > 0),
  ledger_entry_id TEXT NOT NULL UNIQUE REFERENCES ledger_entries(ledger_entry_id),
  created_at_ms INTEGER NOT NULL,
  PRIMARY KEY (usage_session_id, settlement_sequence)
) WITHOUT ROWID, STRICT;

CREATE TABLE refund_reversals (
  refund_event_id TEXT NOT NULL,
  grant_id TEXT NOT NULL REFERENCES balance_grants(grant_id),
  ledger_entry_id TEXT NOT NULL UNIQUE REFERENCES ledger_entries(ledger_entry_id),
  reversed_ms INTEGER NOT NULL CHECK (reversed_ms > 0),
  created_at_ms INTEGER NOT NULL,
  PRIMARY KEY (refund_event_id, grant_id)
) WITHOUT ROWID, STRICT;

CREATE TABLE projection_versions (
  customer_id TEXT PRIMARY KEY REFERENCES customers(customer_id),
  version INTEGER NOT NULL CHECK (version >= 0),
  last_ledger_entry_id TEXT REFERENCES ledger_entries(ledger_entry_id),
  rebuilt_at_ms INTEGER,
  updated_at_ms INTEGER NOT NULL
) STRICT;
