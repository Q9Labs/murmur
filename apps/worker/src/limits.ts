import {
  beginSummaryWithStores,
  beginTranslationWithStores,
  canCreateSessionWithStores,
  canRefreshTokensWithStores,
  closeSessionWithStores,
  createSessionRecordWithStores,
  endSummaryWithStores,
  endTranslationWithStores,
} from "./rateLimiter/sessionStore";

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

export function beginTranslation(params: {
  app_session_id: string;
  config: RateLimitConfig;
  source_caption: string;
  now_ms: number;
}): LimitResult {
  return beginTranslationWithStores(params, memoryStore);
}

export function endTranslation(appSessionId: string): void {
  endTranslationWithStores(appSessionId, sessionsById);
}

export function beginSummary(params: {
  app_session_id: string;
  config: RateLimitConfig;
  now_ms: number;
}): LimitResult {
  return beginSummaryWithStores(params, memoryStore);
}

export function endSummary(appSessionId: string): void {
  endSummaryWithStores(appSessionId, sessionsById);
}

export function closeSession(appSessionId: string, nowMs: number): void {
  closeSessionWithStores(appSessionId, nowMs, sessionsById);
}

export function canRefreshTokens(params: {
  app_session_id: string;
  config: RateLimitConfig;
  hashed_install_id: string;
  now_ms: number;
}): LimitResult {
  return canRefreshTokensWithStores(params, memoryStore);
}

export function getSession(appSessionId: string): SessionRecord | null {
  return sessionsById.get(appSessionId) ?? null;
}
