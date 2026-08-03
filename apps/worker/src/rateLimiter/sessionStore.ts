import type {
  LimitResult,
  RateLimitConfig,
  RealtimeReservationResult,
  SessionRecord,
} from "../limits";

export type SessionStore = {
  sessionStartsByInstall: Map<string, number[]>;
  sessionsById: Map<string, SessionRecord>;
};

export function createSessionRecordWithStores(
  params: {
    app_session_id: string;
    hashed_install_id: string;
    now_ms: number;
  },
  store: SessionStore,
): SessionRecord {
  const record: SessionRecord = {
    app_session_id: params.app_session_id,
    closed_at_ms: null,
    created_at_ms: params.now_ms,
    hashed_install_id: params.hashed_install_id,
    realtime_connected_at_ms: null,
  };
  store.sessionsById.set(params.app_session_id, record);
  const starts = store.sessionStartsByInstall.get(params.hashed_install_id) ?? [];
  starts.push(params.now_ms);
  store.sessionStartsByInstall.set(params.hashed_install_id, starts);
  return record;
}

export function canCreateSessionWithStores(
  params: {
    config: RateLimitConfig;
    hashed_install_id: string;
    now_ms: number;
  },
  store: SessionStore,
): LimitResult {
  pruneInstallStartsWithStores(
    params.hashed_install_id,
    params.now_ms,
    store.sessionStartsByInstall,
  );
  closeExpiredSessionsWithStores(params.config, params.now_ms, store.sessionsById);

  const activeSessions = [...store.sessionsById.values()].filter(
    (session) =>
      session.hashed_install_id === params.hashed_install_id &&
      session.closed_at_ms === null,
  );
  if (activeSessions.length >= params.config.activeSessionsPerInstall) {
    return { ok: false, code: "active_session_limit" };
  }

  const starts = store.sessionStartsByInstall.get(params.hashed_install_id) ?? [];
  const startsInHour = starts.filter(
    (timestamp) => timestamp >= params.now_ms - 60 * 60 * 1000,
  );
  const startsInDay = starts.filter(
    (timestamp) => timestamp >= params.now_ms - 24 * 60 * 60 * 1000,
  );
  if (startsInHour.length >= params.config.sessionsPerHour) {
    return { ok: false, code: "sessions_per_hour_limit" };
  }
  if (startsInDay.length >= params.config.sessionsPerDay) {
    return { ok: false, code: "sessions_per_day_limit" };
  }
  return { ok: true };
}

export function closeSessionWithStores(
  appSessionId: string,
  nowMs: number,
  sessionsById: Map<string, SessionRecord>,
): void {
  const session = sessionsById.get(appSessionId);
  if (session && session.closed_at_ms === null) {
    session.closed_at_ms = nowMs;
  }
}

export function reserveRealtimeSessionWithStores(
  params: {
    app_session_id: string;
    config: RateLimitConfig;
    now_ms: number;
  },
  sessionsById: Map<string, SessionRecord>,
): RealtimeReservationResult {
  const session = sessionsById.get(params.app_session_id);
  if (!session || session.closed_at_ms !== null) {
    return { code: "session_closed", ok: false };
  }
  const expiresAtMs = session.created_at_ms + params.config.maxSessionSeconds * 1_000;
  if (params.now_ms >= expiresAtMs) {
    session.closed_at_ms = params.now_ms;
    return { code: "session_expired", ok: false };
  }
  if (session.realtime_connected_at_ms != null) {
    return { code: "session_already_connected", ok: false };
  }
  session.realtime_connected_at_ms = params.now_ms;
  return {
    expires_at_ms: expiresAtMs,
    hashed_install_id: session.hashed_install_id,
    ok: true,
  };
}

function closeExpiredSessionsWithStores(
  config: RateLimitConfig,
  nowMs: number,
  sessionsById: Map<string, SessionRecord>,
): void {
  for (const session of sessionsById.values()) {
    if (
      session.closed_at_ms === null &&
      nowMs - session.created_at_ms >= config.maxSessionSeconds * 1000
    ) {
      session.closed_at_ms = nowMs;
    }
  }
}

function pruneInstallStartsWithStores(
  hashedInstallId: string,
  nowMs: number,
  startsByInstall: Map<string, number[]>,
): void {
  const starts = startsByInstall.get(hashedInstallId) ?? [];
  startsByInstall.set(
    hashedInstallId,
    starts.filter((timestamp) => timestamp >= nowMs - 24 * 60 * 60 * 1000),
  );
}
