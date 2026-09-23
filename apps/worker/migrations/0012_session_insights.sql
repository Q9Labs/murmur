INSERT INTO schema_migrations (version, name, applied_at_ms)
VALUES (12, 'session_insights', unixepoch('subsec') * 1000);

CREATE TABLE customer_insights_consent (
  customer_id TEXT PRIMARY KEY,
  consent INTEGER NOT NULL CHECK (consent IN (0, 1)),
  updated_at TEXT NOT NULL
);

CREATE TABLE insight_session_context (
  app_session_id TEXT PRIMARY KEY,
  customer_id TEXT,
  hashed_install_id TEXT NOT NULL,
  source_language TEXT NOT NULL,
  target_language TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE session_insights (
  app_session_id TEXT PRIMARY KEY,
  customer_id TEXT,
  hashed_install_id TEXT NOT NULL,
  source_language TEXT NOT NULL,
  target_language TEXT NOT NULL,
  duration_ms INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  insight_json TEXT NOT NULL
);

CREATE INDEX session_insights_customer_id_idx ON session_insights(customer_id);
