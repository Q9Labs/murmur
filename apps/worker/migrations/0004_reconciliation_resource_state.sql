PRAGMA foreign_keys = ON;

INSERT INTO schema_migrations (version, name, applied_at_ms)
VALUES (4, 'reconciliation_resource_state', unixepoch('subsec') * 1000);

CREATE TABLE reconciliation_resource_states (
  resource_key TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(customer_id),
  resource_kind TEXT NOT NULL CHECK (resource_kind IN ('purchase', 'subscription')),
  fingerprint TEXT NOT NULL,
  transition_sequence INTEGER NOT NULL CHECK (transition_sequence > 0),
  state TEXT NOT NULL CHECK (state IN ('pending', 'applied')),
  updated_at_ms INTEGER NOT NULL
) STRICT;

CREATE INDEX reconciliation_resource_states_customer_idx
ON reconciliation_resource_states (customer_id, resource_kind);
