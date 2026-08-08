import { defaultRateLimits } from "../limits";
import type {
  canCreateSession,
  createSessionRecord,
  LimitResult,
  SessionRecord,
} from "../limits";
import {
  canCreateSessionWithStores,
  closeSessionWithStores,
  createSessionRecordWithStores,
  reserveRealtimeSessionWithStores,
  type SessionStore,
} from "./sessionStore";
import type {
  AppAttestDeviceRecord,
  DurableLimitState,
  ReportInboxRecord,
} from "./types";

export function createEmptyDurableLimitState(): DurableLimitState {
  return {
    app_attest_devices_by_key_id: {},
    report_inbox_by_id: {},
    report_inbox_order: [],
    report_timestamps_by_session: {},
    session_starts_by_install: {},
    sessions_by_id: {},
  };
}

export function createMemoryAdapter(state: DurableLimitState) {
  const appAttestDevices = new Map(Object.entries(state.app_attest_devices_by_key_id ?? {}));
  const reportInboxById = new Map(Object.entries(state.report_inbox_by_id ?? {}));
  const reportInboxOrder = [...(state.report_inbox_order ?? [])];
  const reportsBySession = new Map(Object.entries(state.report_timestamps_by_session ?? {}));
  const sessionsById = new Map(Object.entries(state.sessions_by_id));
  const startsByInstall = new Map(Object.entries(state.session_starts_by_install));
  const sessionStore: SessionStore = { sessionStartsByInstall: startsByInstall, sessionsById };
  return {
    canAcceptReport: (appSessionId: string, nowMs: number) => {
      const result = canAcceptReportWithStores(
        appSessionId,
        nowMs,
        reportsBySession,
        sessionsById,
      );
      syncMaps(state, sessionsById, startsByInstall, reportsBySession);
      return result;
    },
    canCreateSession: (params: Parameters<typeof canCreateSession>[0]) => {
      const result = canCreateSessionWithStores(params, sessionStore);
      syncMaps(state, sessionsById, startsByInstall);
      return result;
    },
    closeSession: (appSessionId: string, nowMs: number) => {
      closeSessionWithStores(appSessionId, nowMs, sessionsById);
      syncMaps(state, sessionsById, startsByInstall, reportsBySession, appAttestDevices);
    },
    createSessionRecord: (params: Parameters<typeof createSessionRecord>[0]) => {
      const record = createSessionRecordWithStores(params, sessionStore);
      syncMaps(state, sessionsById, startsByInstall, reportsBySession, appAttestDevices);
      return record;
    },
    getAppAttestDevice: (keyId: string) => appAttestDevices.get(keyId) ?? null,
    getSession: (appSessionId: string) => sessionsById.get(appSessionId) ?? null,
    reserveRealtimeSession: (appSessionId: string, nowMs: number) => {
      const result = reserveRealtimeSessionWithStores({
        app_session_id: appSessionId,
        config: defaultRateLimits,
        now_ms: nowMs,
      }, sessionsById);
      syncMaps(state, sessionsById, startsByInstall, reportsBySession, appAttestDevices);
      return result;
    },
    deleteReport: (reportId: string) => {
      const deleted = reportInboxById.delete(reportId);
      const existingIndex = reportInboxOrder.indexOf(reportId);
      if (existingIndex >= 0) {
        reportInboxOrder.splice(existingIndex, 1);
      }
      syncMaps(state, sessionsById, startsByInstall, reportsBySession, appAttestDevices, reportInboxById, reportInboxOrder);
      return { deleted };
    },
    listReports: (limit: number) => reportInboxOrder
      .slice(0, Math.max(1, Math.min(200, limit)))
      .map((reportId) => reportInboxById.get(reportId))
      .filter((report): report is ReportInboxRecord => Boolean(report)),
    storeReport: (report: ReportInboxRecord) => {
      reportInboxById.set(report.report_id, report);
      const existingIndex = reportInboxOrder.indexOf(report.report_id);
      if (existingIndex >= 0) {
        reportInboxOrder.splice(existingIndex, 1);
      }
      reportInboxOrder.unshift(report.report_id);
      pruneReportInboxWithStores(Date.now(), reportInboxById, reportInboxOrder);
      syncMaps(state, sessionsById, startsByInstall, reportsBySession, appAttestDevices, reportInboxById, reportInboxOrder);
    },
    storeAppAttestDevice: (params: {
      hashed_install_id: string;
      key_id: string;
      now_ms: number;
      public_key_pem: string;
      sign_count: number;
    }) => {
      appAttestDevices.set(params.key_id, {
        created_at_ms: params.now_ms,
        hashed_install_id: params.hashed_install_id,
        key_id: params.key_id,
        public_key_pem: params.public_key_pem,
        sign_count: params.sign_count,
        updated_at_ms: params.now_ms,
      });
      syncMaps(state, sessionsById, startsByInstall, reportsBySession, appAttestDevices);
    },
    updateAppAttestSignCount: (keyId: string, signCount: number, nowMs: number) => {
      const device = appAttestDevices.get(keyId);
      if (!device || signCount <= device.sign_count) {
        return { ok: false };
      }
      device.sign_count = signCount;
      device.updated_at_ms = nowMs;
      syncMaps(state, sessionsById, startsByInstall, reportsBySession, appAttestDevices);
      return { ok: true };
    },
  };
}

export function canAcceptReportWithStores(
  appSessionId: string,
  nowMs: number,
  reportsBySession: Map<string, number[]>,
  sessionsById?: Map<string, SessionRecord>,
): LimitResult {
  const session = sessionsById?.get(appSessionId);
  if (sessionsById && !session) {
    return { ok: false, code: "session_closed" };
  }
  if (
    session &&
    nowMs - session.created_at_ms > defaultRateLimits.maxSessionSeconds * 1000
  ) {
    return { ok: false, code: "session_expired" };
  }
  const timestamps = (reportsBySession.get(appSessionId) ?? []).filter(
    (timestamp) => timestamp >= nowMs - 60 * 60 * 1000,
  );
  if (timestamps.length >= 10) {
    reportsBySession.set(appSessionId, timestamps);
    return { ok: false, code: "report_rate_limited" };
  }
  timestamps.push(nowMs);
  reportsBySession.set(appSessionId, timestamps);
  return { ok: true };
}

function syncMaps(
  state: DurableLimitState,
  sessionsById: Map<string, SessionRecord>,
  startsByInstall: Map<string, number[]>,
  reportsBySession?: Map<string, number[]>,
  appAttestDevices?: Map<string, AppAttestDeviceRecord>,
  reportInboxById?: Map<string, ReportInboxRecord>,
  reportInboxOrder?: string[],
): void {
  state.sessions_by_id = Object.fromEntries(sessionsById);
  state.session_starts_by_install = Object.fromEntries(startsByInstall);
  if (reportsBySession) {
    state.report_timestamps_by_session = Object.fromEntries(reportsBySession);
  }
  if (appAttestDevices) {
    state.app_attest_devices_by_key_id = Object.fromEntries(appAttestDevices);
  }
  if (reportInboxById && reportInboxOrder) {
    state.report_inbox_by_id = Object.fromEntries(reportInboxById);
    state.report_inbox_order = reportInboxOrder;
  }
}

export function pruneState(state: DurableLimitState, nowMs: number): void {
  for (const [sessionId, session] of Object.entries(state.sessions_by_id)) {
    const closedLongAgo =
      session.closed_at_ms !== null && nowMs - session.closed_at_ms > 24 * 60 * 60 * 1000;
    const expiredLongAgo =
      session.closed_at_ms === null &&
      nowMs - session.created_at_ms > defaultRateLimits.maxSessionSeconds * 1000 * 2;
    if (closedLongAgo || expiredLongAgo) {
      delete state.sessions_by_id[sessionId];
    }
  }

  for (const [installId, starts] of Object.entries(state.session_starts_by_install)) {
    const retained = starts.filter((timestamp) => timestamp >= nowMs - 24 * 60 * 60 * 1000);
    if (retained.length === 0) {
      delete state.session_starts_by_install[installId];
    } else {
      state.session_starts_by_install[installId] = retained;
    }
  }

  for (const [sessionId, reports] of Object.entries(state.report_timestamps_by_session ?? {})) {
    const retained = reports.filter((timestamp) => timestamp >= nowMs - 60 * 60 * 1000);
    if (retained.length === 0) {
      delete state.report_timestamps_by_session[sessionId];
    } else {
      state.report_timestamps_by_session[sessionId] = retained;
    }
  }

  pruneReportInboxState(state, nowMs);
}

function pruneReportInboxState(state: DurableLimitState, nowMs: number): void {
  const inboxById = new Map(Object.entries(state.report_inbox_by_id ?? {}));
  const inboxOrder = [...(state.report_inbox_order ?? [])];
  pruneReportInboxWithStores(nowMs, inboxById, inboxOrder);
  state.report_inbox_by_id = Object.fromEntries(inboxById);
  state.report_inbox_order = inboxOrder;
}

export function pruneReportInboxWithStores(
  nowMs: number,
  inboxById: Map<string, ReportInboxRecord>,
  inboxOrder: string[],
): void {
  const retentionWindowMs = 30 * 24 * 60 * 60 * 1000;
  for (const [reportId, report] of inboxById) {
    if (nowMs - report.created_at_ms > retentionWindowMs) {
      inboxById.delete(reportId);
    }
  }
  const retained = inboxOrder.filter((reportId) => inboxById.has(reportId)).slice(0, 500);
  inboxOrder.splice(0, inboxOrder.length, ...retained);
  for (const reportId of inboxById.keys()) {
    if (!inboxOrder.includes(reportId)) {
      inboxById.delete(reportId);
    }
  }
}
