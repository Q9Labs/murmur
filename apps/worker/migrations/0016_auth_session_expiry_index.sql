INSERT INTO schema_migrations (version, name, applied_at_ms)
VALUES (16, 'auth_session_expiry_index', unixepoch('subsec') * 1000);

CREATE INDEX "session_expiresAt_idx" ON "session" ("expiresAt");
