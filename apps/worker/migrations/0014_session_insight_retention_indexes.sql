INSERT INTO schema_migrations (version, name, applied_at_ms)
VALUES (14, 'session_insight_retention_indexes', unixepoch('subsec') * 1000);

CREATE INDEX session_insights_created_at_idx ON session_insights(created_at);
CREATE INDEX insight_session_context_created_at_idx ON insight_session_context(created_at);
