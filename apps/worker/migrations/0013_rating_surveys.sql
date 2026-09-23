CREATE TABLE rating_surveys (
  id TEXT PRIMARY KEY,
  hashed_install_id TEXT NOT NULL,
  stars INTEGER NOT NULL CHECK (stars BETWEEN 1 AND 5),
  setting TEXT NOT NULL,
  other_text TEXT,
  created_at TEXT NOT NULL
);
