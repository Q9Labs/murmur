INSERT INTO schema_migrations (version, name, applied_at_ms)
VALUES (13, 'rating_surveys', unixepoch('subsec') * 1000);

CREATE TABLE rating_surveys (
  id TEXT PRIMARY KEY,
  customer_id TEXT,
  hashed_install_id TEXT NOT NULL,
  stars INTEGER NOT NULL CHECK (stars BETWEEN 1 AND 5),
  setting TEXT NOT NULL,
  other_text TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX rating_surveys_customer_id_idx ON rating_surveys(customer_id);
