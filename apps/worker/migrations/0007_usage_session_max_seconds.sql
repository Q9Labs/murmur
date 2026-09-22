ALTER TABLE usage_sessions ADD COLUMN max_session_seconds INTEGER NOT NULL DEFAULT 300 CHECK (max_session_seconds > 0);
