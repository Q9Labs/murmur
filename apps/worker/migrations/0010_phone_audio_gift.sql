INSERT INTO schema_migrations (version, name, applied_at_ms)
VALUES (10, 'phone_audio_gift', unixepoch('subsec') * 1000);

CREATE TABLE phone_audio_gifts (
  customer_id TEXT PRIMARY KEY,
  claimed_at_ms INTEGER NOT NULL,
  remaining_ms INTEGER NOT NULL CHECK (remaining_ms >= 0 AND remaining_ms <= 180000)
) STRICT;

CREATE TABLE phone_audio_gift_sessions (
  usage_session_id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  settled_ms INTEGER NOT NULL DEFAULT 0 CHECK (settled_ms >= 0),
  FOREIGN KEY (customer_id) REFERENCES phone_audio_gifts(customer_id)
) STRICT;

CREATE TRIGGER phone_audio_gift_settlement
AFTER UPDATE OF settled_ms ON phone_audio_gift_sessions
WHEN NEW.settled_ms > OLD.settled_ms
BEGIN
  UPDATE phone_audio_gifts
  SET remaining_ms = MAX(0, remaining_ms - (NEW.settled_ms - OLD.settled_ms))
  WHERE customer_id = NEW.customer_id;
END;
