INSERT INTO schema_migrations (version, name, applied_at_ms)
VALUES (7, 'usage_session_max_seconds', unixepoch('subsec') * 1000);

ALTER TABLE usage_sessions ADD COLUMN max_session_seconds INTEGER NOT NULL DEFAULT 300 CHECK (max_session_seconds > 0);
