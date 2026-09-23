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
  hashed_install_id TEXT NOT NULL,
  source_language TEXT NOT NULL,
  target_language TEXT NOT NULL,
  duration_ms INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  insight_json TEXT NOT NULL
);
