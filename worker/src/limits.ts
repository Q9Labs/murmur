export type RateLimitConfig = {
  activeSessionsPerInstall: number;
  concurrentSummariesPerSession: number;
  concurrentTranslationsPerSession: number;
  maxCharsPerSpan: number;
  maxSessionSeconds: number;
  sessionsPerDay: number;
  sessionsPerHour: number;
  summariesPerMinute: number;
  translatedSpansPerMinute: number;
};

export type SessionRecord = {
  app_session_id: string;
  closed_at_ms: number | null;
  created_at_ms: number;
  hashed_install_id: string;
  in_flight_summaries: number;
  in_flight_translations: number;
  summary_timestamps: number[];
  translated_span_timestamps: number[];
};

export type LimitResult =
  | { ok: true }
  | { ok: false; code: string; retry_after_ms?: number };

export const defaultRateLimits: RateLimitConfig = {
  activeSessionsPerInstall: 1,
  concurrentSummariesPerSession: 1,
  concurrentTranslationsPerSession: 2,
  maxCharsPerSpan: 600,
  maxSessionSeconds: 900,
  sessionsPerDay: 30,
  sessionsPerHour: 6,
  summariesPerMinute: 6,
  translatedSpansPerMinute: 60,
};

const sessionsById = new Map<string, SessionRecord>();
const sessionStartsByInstall = new Map<string, number[]>();

export function createSessionRecord(params: {
  app_session_id: string;
  hashed_install_id: string;
  now_ms: number;
}): SessionRecord {
  const record: SessionRecord = {
    app_session_id: params.app_session_id,
    closed_at_ms: null,
    created_at_ms: params.now_ms,
    hashed_install_id: params.hashed_install_id,
    in_flight_summaries: 0,
    in_flight_translations: 0,
    summary_timestamps: [],
    translated_span_timestamps: [],
  };
  sessionsById.set(params.app_session_id, record);
  const starts = sessionStartsByInstall.get(params.hashed_install_id) ?? [];
  starts.push(params.now_ms);
  sessionStartsByInstall.set(params.hashed_install_id, starts);
  return record;
}

export function canCreateSession(params: {
  config: RateLimitConfig;
  hashed_install_id: string;
  now_ms: number;
}): LimitResult {
  pruneInstallStarts(params.hashed_install_id, params.now_ms);
  closeExpiredSessions(params.config, params.now_ms);

  const activeSessions = [...sessionsById.values()].filter(
    (session) =>
      session.hashed_install_id === params.hashed_install_id &&
      session.closed_at_ms === null,
  );
  if (activeSessions.length >= params.config.activeSessionsPerInstall) {
    return { ok: false, code: "active_session_limit" };
  }

  const starts = sessionStartsByInstall.get(params.hashed_install_id) ?? [];
  const hourAgo = params.now_ms - 60 * 60 * 1000;
  const dayAgo = params.now_ms - 24 * 60 * 60 * 1000;
  const startsInHour = starts.filter((timestamp) => timestamp >= hourAgo);
  const startsInDay = starts.filter((timestamp) => timestamp >= dayAgo);

  if (startsInHour.length >= params.config.sessionsPerHour) {
    return { ok: false, code: "sessions_per_hour_limit" };
  }
  if (startsInDay.length >= params.config.sessionsPerDay) {
    return { ok: false, code: "sessions_per_day_limit" };
  }

  return { ok: true };
}

export function beginTranslation(params: {
  app_session_id: string;
  config: RateLimitConfig;
  source_caption: string;
  now_ms: number;
}): LimitResult {
  const session = sessionsById.get(params.app_session_id);
  if (!session || session.closed_at_ms !== null) {
    return { ok: false, code: "session_closed" };
  }

  if (params.now_ms - session.created_at_ms > params.config.maxSessionSeconds * 1000) {
    closeSession(params.app_session_id, params.now_ms);
    return { ok: false, code: "session_expired" };
  }

  if (params.source_caption.length > params.config.maxCharsPerSpan) {
    return { ok: false, code: "span_too_long" };
  }

  session.translated_span_timestamps = session.translated_span_timestamps.filter(
    (timestamp) => timestamp >= params.now_ms - 60 * 1000,
  );
  if (session.translated_span_timestamps.length >= params.config.translatedSpansPerMinute) {
    return { ok: false, code: "translated_spans_per_minute_limit" };
  }

  if (session.in_flight_translations >= params.config.concurrentTranslationsPerSession) {
    return { ok: false, code: "concurrent_translation_limit" };
  }

  session.in_flight_translations += 1;
  session.translated_span_timestamps.push(params.now_ms);
  return { ok: true };
}

export function endTranslation(appSessionId: string): void {
  const session = sessionsById.get(appSessionId);
  if (session) {
    session.in_flight_translations = Math.max(0, session.in_flight_translations - 1);
  }
}

export function beginSummary(params: {
  app_session_id: string;
  config: RateLimitConfig;
  now_ms: number;
}): LimitResult {
  const session = sessionsById.get(params.app_session_id);
  if (!session || session.closed_at_ms !== null) {
    return { ok: false, code: "session_closed" };
  }

  if (params.now_ms - session.created_at_ms > params.config.maxSessionSeconds * 1000) {
    closeSession(params.app_session_id, params.now_ms);
    return { ok: false, code: "session_expired" };
  }

  session.summary_timestamps = (session.summary_timestamps ?? []).filter(
    (timestamp) => timestamp >= params.now_ms - 60 * 1000,
  );
  if (session.summary_timestamps.length >= params.config.summariesPerMinute) {
    return { ok: false, code: "summaries_per_minute_limit" };
  }

  if ((session.in_flight_summaries ?? 0) >= params.config.concurrentSummariesPerSession) {
    return { ok: false, code: "concurrent_summary_limit" };
  }

  session.in_flight_summaries = (session.in_flight_summaries ?? 0) + 1;
  session.summary_timestamps.push(params.now_ms);
  return { ok: true };
}

export function endSummary(appSessionId: string): void {
  const session = sessionsById.get(appSessionId);
  if (session) {
    session.in_flight_summaries = Math.max(0, (session.in_flight_summaries ?? 0) - 1);
  }
}

export function closeSession(appSessionId: string, nowMs: number): void {
  const session = sessionsById.get(appSessionId);
  if (session && session.closed_at_ms === null) {
    session.closed_at_ms = nowMs;
    session.in_flight_summaries = 0;
    session.in_flight_translations = 0;
  }
}

export function canRefreshTokens(params: {
  app_session_id: string;
  config: RateLimitConfig;
  hashed_install_id: string;
  now_ms: number;
}): LimitResult {
  const session = sessionsById.get(params.app_session_id);
  if (!session || session.closed_at_ms !== null) {
    return { ok: false, code: "session_closed" };
  }
  if (session.hashed_install_id !== params.hashed_install_id) {
    return { ok: false, code: "session_install_mismatch" };
  }
  if (params.now_ms - session.created_at_ms > params.config.maxSessionSeconds * 1000) {
    closeSession(params.app_session_id, params.now_ms);
    return { ok: false, code: "session_expired" };
  }
  return { ok: true };
}

export function getSession(appSessionId: string): SessionRecord | null {
  return sessionsById.get(appSessionId) ?? null;
}

function closeExpiredSessions(config: RateLimitConfig, nowMs: number): void {
  for (const session of sessionsById.values()) {
    if (
      session.closed_at_ms === null &&
      nowMs - session.created_at_ms > config.maxSessionSeconds * 1000
    ) {
      session.closed_at_ms = nowMs;
      session.in_flight_summaries = 0;
      session.in_flight_translations = 0;
    }
  }
}

function pruneInstallStarts(hashedInstallId: string, nowMs: number): void {
  const starts = sessionStartsByInstall.get(hashedInstallId) ?? [];
  sessionStartsByInstall.set(
    hashedInstallId,
    starts.filter((timestamp) => timestamp >= nowMs - 24 * 60 * 60 * 1000),
  );
}
