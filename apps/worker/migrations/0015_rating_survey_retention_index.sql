INSERT INTO schema_migrations (version, name, applied_at_ms)
VALUES (15, 'rating_survey_retention_index', unixepoch('subsec') * 1000);

CREATE INDEX rating_surveys_created_at_idx ON rating_surveys(created_at);
