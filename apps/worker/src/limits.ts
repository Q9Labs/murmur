import {
  canCreateSessionWithStores,
  closeSessionWithStores,
  createSessionRecordWithStores,
  reserveRealtimeSessionWithStores,
} from "./rateLimiter/sessionStore";

export type RateLimitConfig = {
  activeSessionsPerInstall: number;
  maxSessionSeconds: number;
  sessionsPerDay: number;
  sessionsPerHour: number;
};

export type SessionRecord = {
  app_session_id: string;
  closed_at_ms: number | null;
  created_at_ms: number;
  hashed_install_id: string;
  realtime_connected_at_ms: number | null;
};

export type RealtimeReservationResult =
  | {
      expires_at_ms: number;
      hashed_install_id: string;
      ok: true;
    }
  | {
      code: "session_already_connected" | "session_closed" | "session_expired";
      ok: false;
    };

export type LimitResult =
  | { ok: true }
  | { ok: false; code: string; retry_after_ms?: number };

export const defaultRateLimits: RateLimitConfig = {
  activeSessionsPerInstall: 1,
  maxSessionSeconds: 900,
  sessionsPerDay: 30,
  sessionsPerHour: 6,
};

const sessionsById = new Map<string, SessionRecord>();
const sessionStartsByInstall = new Map<string, number[]>();
const memoryStore = { sessionStartsByInstall, sessionsById };

export function createSessionRecord(params: {
  app_session_id: string;
  hashed_install_id: string;
  now_ms: number;
}): SessionRecord {
  return createSessionRecordWithStores(params, memoryStore);
}

export function canCreateSession(params: {
  config: RateLimitConfig;
  hashed_install_id: string;
  now_ms: number;
}): LimitResult {
  return canCreateSessionWithStores(params, memoryStore);
}

export function closeSession(appSessionId: string, nowMs: number): void {
  closeSessionWithStores(appSessionId, nowMs, sessionsById);
}

export function reserveRealtimeSession(params: {
  app_session_id: string;
  config: RateLimitConfig;
  now_ms: number;
}): RealtimeReservationResult {
  return reserveRealtimeSessionWithStores(params, sessionsById);
}

export function getSession(appSessionId: string): SessionRecord | null {
  return sessionsById.get(appSessionId) ?? null;
}
