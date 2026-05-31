/// <reference types="@cloudflare/workers-types" />

import {
  beginTranslation,
  canRefreshTokens,
  canCreateSession,
  closeSession,
  createSessionRecord,
  defaultRateLimits,
  endTranslation,
  getSession,
  type LimitResult,
  type SessionRecord,
} from "./limits";

type DurableLimitState = {
  app_attest_devices_by_key_id: Record<string, AppAttestDeviceRecord>;
  report_inbox_by_id: Record<string, ReportInboxRecord>;
  report_inbox_order: string[];
  report_timestamps_by_session: Record<string, number[]>;
  session_starts_by_install: Record<string, number[]>;
  sessions_by_id: Record<string, SessionRecord>;
};

type DurableLimitRequest =
  | {
      action: "can_create_session";
      hashed_install_id: string;
      now_ms: number;
    }
  | {
      action: "create_session_record";
      app_session_id: string;
      hashed_install_id: string;
      now_ms: number;
    }
  | {
      action: "begin_translation";
      app_session_id: string;
      now_ms: number;
      source_caption: string;
    }
  | {
      action: "end_translation";
      app_session_id: string;
    }
  | {
      action: "close_session";
      app_session_id: string;
      now_ms: number;
    }
  | {
      action: "can_accept_report";
      app_session_id: string;
      now_ms: number;
    }
  | {
      action: "store_report";
      report: ReportInboxRecord;
    }
  | {
      action: "list_reports";
      limit: number;
    }
  | {
      action: "delete_report";
      report_id: string;
    }
  | {
      action: "can_refresh_tokens";
      app_session_id: string;
      hashed_install_id: string;
      now_ms: number;
    }
  | {
      action: "get_session";
      app_session_id: string;
    }
  | {
      action: "get_app_attest_device";
      key_id: string;
    }
  | {
      action: "store_app_attest_device";
      hashed_install_id: string;
      key_id: string;
      now_ms: number;
      public_key_pem: string;
      sign_count: number;
    }
  | {
      action: "update_app_attest_sign_count";
      key_id: string;
      now_ms: number;
      sign_count: number;
    };

const stateKey = "rate_limit_state_v1";

export type AppAttestDeviceRecord = {
  created_at_ms: number;
  hashed_install_id: string;
  key_id: string;
  public_key_pem: string;
  sign_count: number;
  updated_at_ms: number;
};

export type ReportInboxRecord = {
  app_session_id: string;
  created_at_ms: number;
  error_category: string;
  provider_metadata?: Record<string, unknown>;
  report_id: string;
  retained_text_snapshot: boolean;
  revision: number;
  source_language: string;
  span_id: string;
  target_language: string;
};

export class RateLimitDurableObject {
  constructor(private readonly state: DurableObjectState) {}

  async fetch(request: Request): Promise<Response> {
    const body = (await request.json().catch(() => null)) as DurableLimitRequest | null;
    if (!body) {
      return json({ error: "invalid_json" }, 400);
    }

    return this.state.blockConcurrencyWhile(async () => {
      const state = await this.loadState();
      const result = this.handle(body, state);
      await this.saveState(state);
      return json(result);
    });
  }

  private handle(body: DurableLimitRequest, state: DurableLimitState): unknown {
    const adapter = createMemoryAdapter(state);
    switch (body.action) {
      case "can_create_session":
        return adapter.canCreateSession({
          config: defaultRateLimits,
          hashed_install_id: body.hashed_install_id,
          now_ms: body.now_ms,
        });
      case "create_session_record":
        return adapter.createSessionRecord({
          app_session_id: body.app_session_id,
          hashed_install_id: body.hashed_install_id,
          now_ms: body.now_ms,
        });
      case "begin_translation":
        return adapter.beginTranslation({
          app_session_id: body.app_session_id,
          config: defaultRateLimits,
          now_ms: body.now_ms,
          source_caption: body.source_caption,
        });
      case "end_translation":
        adapter.endTranslation(body.app_session_id);
        return { ok: true };
      case "close_session":
        adapter.closeSession(body.app_session_id, body.now_ms);
        return { ok: true };
      case "can_accept_report":
        return adapter.canAcceptReport(body.app_session_id, body.now_ms);
      case "store_report":
        adapter.storeReport(body.report);
        return { ok: true };
      case "list_reports":
        return adapter.listReports(body.limit);
      case "delete_report":
        return adapter.deleteReport(body.report_id);
      case "can_refresh_tokens":
        return adapter.canRefreshTokens({
          app_session_id: body.app_session_id,
          hashed_install_id: body.hashed_install_id,
          now_ms: body.now_ms,
        });
      case "get_session":
        return adapter.getSession(body.app_session_id);
      case "get_app_attest_device":
        return adapter.getAppAttestDevice(body.key_id);
      case "store_app_attest_device":
        adapter.storeAppAttestDevice({
          hashed_install_id: body.hashed_install_id,
          key_id: body.key_id,
          now_ms: body.now_ms,
          public_key_pem: body.public_key_pem,
          sign_count: body.sign_count,
        });
        return { ok: true };
      case "update_app_attest_sign_count":
        return adapter.updateAppAttestSignCount(body.key_id, body.sign_count, body.now_ms);
    }
  }

  private async loadState(): Promise<DurableLimitState> {
    return (
      (await this.state.storage.get<DurableLimitState>(stateKey)) ?? {
        app_attest_devices_by_key_id: {},
        report_inbox_by_id: {},
        report_inbox_order: [],
        report_timestamps_by_session: {},
        session_starts_by_install: {},
        sessions_by_id: {},
      }
    );
  }

  private async saveState(state: DurableLimitState): Promise<void> {
    pruneState(state, Date.now());
    await this.state.storage.put(stateKey, state);
  }
}

export async function callRateLimiter(
  namespace: DurableObjectNamespace | undefined,
  body: DurableLimitRequest,
): Promise<unknown> {
  if (!namespace) {
    return callMemoryLimiter(body);
  }

  const stub = namespace.get(namespace.idFromName("global-rate-limiter-v1"));
  const response = await stub.fetch("https://rate-limiter.local/", {
    body: JSON.stringify(body),
    method: "POST",
  });
  return response.json();
}

export async function canCreateSessionDurable(params: {
  hashed_install_id: string;
  namespace?: DurableObjectNamespace;
  now_ms: number;
}): Promise<LimitResult> {
  return (await callRateLimiter(params.namespace, {
    action: "can_create_session",
    hashed_install_id: params.hashed_install_id,
    now_ms: params.now_ms,
  })) as LimitResult;
}

export async function createSessionRecordDurable(params: {
  app_session_id: string;
  hashed_install_id: string;
  namespace?: DurableObjectNamespace;
  now_ms: number;
}): Promise<void> {
  await callRateLimiter(params.namespace, {
    action: "create_session_record",
    app_session_id: params.app_session_id,
    hashed_install_id: params.hashed_install_id,
    now_ms: params.now_ms,
  });
}

export async function beginTranslationDurable(params: {
  app_session_id: string;
  namespace?: DurableObjectNamespace;
  now_ms: number;
  source_caption: string;
}): Promise<LimitResult> {
  return (await callRateLimiter(params.namespace, {
    action: "begin_translation",
    app_session_id: params.app_session_id,
    now_ms: params.now_ms,
    source_caption: params.source_caption,
  })) as LimitResult;
}

export async function endTranslationDurable(params: {
  app_session_id: string;
  namespace?: DurableObjectNamespace;
}): Promise<void> {
  await callRateLimiter(params.namespace, {
    action: "end_translation",
    app_session_id: params.app_session_id,
  });
}

export async function closeSessionDurable(params: {
  app_session_id: string;
  namespace?: DurableObjectNamespace;
  now_ms: number;
}): Promise<void> {
  await callRateLimiter(params.namespace, {
    action: "close_session",
    app_session_id: params.app_session_id,
    now_ms: params.now_ms,
  });
}

export async function canAcceptReportDurable(params: {
  app_session_id: string;
  namespace?: DurableObjectNamespace;
  now_ms: number;
}): Promise<LimitResult> {
  return (await callRateLimiter(params.namespace, {
    action: "can_accept_report",
    app_session_id: params.app_session_id,
    now_ms: params.now_ms,
  })) as LimitResult;
}

export async function storeReportDurable(params: {
  namespace?: DurableObjectNamespace;
  report: ReportInboxRecord;
}): Promise<void> {
  await callRateLimiter(params.namespace, {
    action: "store_report",
    report: params.report,
  });
}

export async function listReportsDurable(params: {
  limit: number;
  namespace?: DurableObjectNamespace;
}): Promise<ReportInboxRecord[]> {
  return (await callRateLimiter(params.namespace, {
    action: "list_reports",
    limit: params.limit,
  })) as ReportInboxRecord[];
}

export async function deleteReportDurable(params: {
  namespace?: DurableObjectNamespace;
  report_id: string;
}): Promise<{ deleted: boolean }> {
  return (await callRateLimiter(params.namespace, {
    action: "delete_report",
    report_id: params.report_id,
  })) as { deleted: boolean };
}

export async function canRefreshTokensDurable(params: {
  app_session_id: string;
  hashed_install_id: string;
  namespace?: DurableObjectNamespace;
  now_ms: number;
}): Promise<LimitResult> {
  return (await callRateLimiter(params.namespace, {
    action: "can_refresh_tokens",
    app_session_id: params.app_session_id,
    hashed_install_id: params.hashed_install_id,
    now_ms: params.now_ms,
  })) as LimitResult;
}

export async function getSessionDurable(params: {
  app_session_id: string;
  namespace?: DurableObjectNamespace;
}): Promise<SessionRecord | null> {
  return (await callRateLimiter(params.namespace, {
    action: "get_session",
    app_session_id: params.app_session_id,
  })) as SessionRecord | null;
}

export async function getAppAttestDeviceDurable(params: {
  key_id: string;
  namespace?: DurableObjectNamespace;
}): Promise<AppAttestDeviceRecord | null> {
  return (await callRateLimiter(params.namespace, {
    action: "get_app_attest_device",
    key_id: params.key_id,
  })) as AppAttestDeviceRecord | null;
}

export async function storeAppAttestDeviceDurable(params: {
  hashed_install_id: string;
  key_id: string;
  namespace?: DurableObjectNamespace;
  now_ms: number;
  public_key_pem: string;
  sign_count: number;
}): Promise<void> {
  await callRateLimiter(params.namespace, {
    action: "store_app_attest_device",
    hashed_install_id: params.hashed_install_id,
    key_id: params.key_id,
    now_ms: params.now_ms,
    public_key_pem: params.public_key_pem,
    sign_count: params.sign_count,
  });
}

export async function updateAppAttestSignCountDurable(params: {
  key_id: string;
  namespace?: DurableObjectNamespace;
  now_ms: number;
  sign_count: number;
}): Promise<{ ok: boolean }> {
  return (await callRateLimiter(params.namespace, {
    action: "update_app_attest_sign_count",
    key_id: params.key_id,
    now_ms: params.now_ms,
    sign_count: params.sign_count,
  })) as { ok: boolean };
}

function callMemoryLimiter(body: DurableLimitRequest): unknown {
  switch (body.action) {
    case "can_create_session":
      return canCreateSession({
        config: defaultRateLimits,
        hashed_install_id: body.hashed_install_id,
        now_ms: body.now_ms,
      });
    case "create_session_record":
      return createSessionRecord({
        app_session_id: body.app_session_id,
        hashed_install_id: body.hashed_install_id,
        now_ms: body.now_ms,
      });
    case "begin_translation":
      return beginTranslation({
        app_session_id: body.app_session_id,
        config: defaultRateLimits,
        now_ms: body.now_ms,
        source_caption: body.source_caption,
      });
    case "end_translation":
      endTranslation(body.app_session_id);
      return { ok: true };
    case "close_session":
      closeSession(body.app_session_id, body.now_ms);
      return { ok: true };
    case "can_accept_report":
      return canAcceptReportMemory(body.app_session_id, body.now_ms);
    case "store_report":
      reportInboxById.set(body.report.report_id, body.report);
      reportInboxOrder.unshift(body.report.report_id);
      pruneReportInboxMemory(Date.now());
      return { ok: true };
    case "list_reports":
      return listReportInboxMemory(body.limit);
    case "delete_report":
      return deleteReportInboxMemory(body.report_id);
    case "can_refresh_tokens":
      return canRefreshTokens({
        app_session_id: body.app_session_id,
        config: defaultRateLimits,
        hashed_install_id: body.hashed_install_id,
        now_ms: body.now_ms,
      });
    case "get_session":
      return getSession(body.app_session_id);
    case "get_app_attest_device":
      return appAttestDevicesByKeyId.get(body.key_id) ?? null;
    case "store_app_attest_device":
      appAttestDevicesByKeyId.set(body.key_id, {
        created_at_ms: body.now_ms,
        hashed_install_id: body.hashed_install_id,
        key_id: body.key_id,
        public_key_pem: body.public_key_pem,
        sign_count: body.sign_count,
        updated_at_ms: body.now_ms,
      });
      return { ok: true };
    case "update_app_attest_sign_count": {
      const device = appAttestDevicesByKeyId.get(body.key_id);
      if (!device || body.sign_count <= device.sign_count) {
        return { ok: false };
      }
      device.sign_count = body.sign_count;
      device.updated_at_ms = body.now_ms;
      return { ok: true };
    }
  }
}

const reportTimestampsBySession = new Map<string, number[]>();
const reportInboxById = new Map<string, ReportInboxRecord>();
const reportInboxOrder: string[] = [];
const appAttestDevicesByKeyId = new Map<string, AppAttestDeviceRecord>();

function createMemoryAdapter(state: DurableLimitState) {
  const appAttestDevices = new Map(Object.entries(state.app_attest_devices_by_key_id ?? {}));
  const reportInboxById = new Map(Object.entries(state.report_inbox_by_id ?? {}));
  const reportInboxOrder = [...(state.report_inbox_order ?? [])];
  const reportsBySession = new Map(Object.entries(state.report_timestamps_by_session ?? {}));
  const sessionsById = new Map(Object.entries(state.sessions_by_id));
  const startsByInstall = new Map(Object.entries(state.session_starts_by_install));
  return {
    beginTranslation: (params: Parameters<typeof beginTranslation>[0]) => {
      const result = beginTranslationWithStores(params, sessionsById);
      syncMaps(state, sessionsById, startsByInstall);
      return result;
    },
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
      const result = canCreateSessionWithStores(params, sessionsById, startsByInstall);
      syncMaps(state, sessionsById, startsByInstall);
      return result;
    },
    canRefreshTokens: (params: {
      app_session_id: string;
      hashed_install_id: string;
      now_ms: number;
    }) => {
      const result = canRefreshTokensWithStores(params, sessionsById);
      syncMaps(state, sessionsById, startsByInstall, reportsBySession, appAttestDevices);
      return result;
    },
    closeSession: (appSessionId: string, nowMs: number) => {
      closeSessionWithStores(appSessionId, nowMs, sessionsById);
      syncMaps(state, sessionsById, startsByInstall, reportsBySession, appAttestDevices);
    },
    createSessionRecord: (params: Parameters<typeof createSessionRecord>[0]) => {
      const record = createSessionRecordWithStores(params, sessionsById, startsByInstall);
      syncMaps(state, sessionsById, startsByInstall, reportsBySession, appAttestDevices);
      return record;
    },
    endTranslation: (appSessionId: string) => {
      endTranslationWithStores(appSessionId, sessionsById);
      syncMaps(state, sessionsById, startsByInstall, reportsBySession, appAttestDevices);
    },
    getAppAttestDevice: (keyId: string) => appAttestDevices.get(keyId) ?? null,
    getSession: (appSessionId: string) => sessionsById.get(appSessionId) ?? null,
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

function canAcceptReportMemory(appSessionId: string, nowMs: number): LimitResult {
  const session = getSession(appSessionId);
  if (!session) {
    return { ok: false, code: "session_closed" };
  }
  if (nowMs - session.created_at_ms > defaultRateLimits.maxSessionSeconds * 1000) {
    return { ok: false, code: "session_expired" };
  }
  return canAcceptReportWithStores(appSessionId, nowMs, reportTimestampsBySession);
}

function canAcceptReportWithStores(
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

function createSessionRecordWithStores(
  params: Parameters<typeof createSessionRecord>[0],
  sessionsById: Map<string, SessionRecord>,
  startsByInstall: Map<string, number[]>,
): SessionRecord {
  const record: SessionRecord = {
    app_session_id: params.app_session_id,
    closed_at_ms: null,
    created_at_ms: params.now_ms,
    hashed_install_id: params.hashed_install_id,
    in_flight_translations: 0,
    translated_span_timestamps: [],
  };
  sessionsById.set(params.app_session_id, record);
  startsByInstall.set(params.hashed_install_id, [
    ...(startsByInstall.get(params.hashed_install_id) ?? []),
    params.now_ms,
  ]);
  return record;
}

function canCreateSessionWithStores(
  params: Parameters<typeof canCreateSession>[0],
  sessionsById: Map<string, SessionRecord>,
  startsByInstall: Map<string, number[]>,
): LimitResult {
  pruneInstallStartsWithStores(params.hashed_install_id, params.now_ms, startsByInstall);
  closeExpiredSessionsWithStores(params.config, params.now_ms, sessionsById);

  const activeSessions = [...sessionsById.values()].filter(
    (session) =>
      session.hashed_install_id === params.hashed_install_id &&
      session.closed_at_ms === null,
  );
  if (activeSessions.length >= params.config.activeSessionsPerInstall) {
    return { ok: false, code: "active_session_limit" };
  }

  const starts = startsByInstall.get(params.hashed_install_id) ?? [];
  const hourAgo = params.now_ms - 60 * 60 * 1000;
  const dayAgo = params.now_ms - 24 * 60 * 60 * 1000;
  if (starts.filter((timestamp) => timestamp >= hourAgo).length >= params.config.sessionsPerHour) {
    return { ok: false, code: "sessions_per_hour_limit" };
  }
  if (starts.filter((timestamp) => timestamp >= dayAgo).length >= params.config.sessionsPerDay) {
    return { ok: false, code: "sessions_per_day_limit" };
  }
  return { ok: true };
}

function beginTranslationWithStores(
  params: Parameters<typeof beginTranslation>[0],
  sessionsById: Map<string, SessionRecord>,
): LimitResult {
  const session = sessionsById.get(params.app_session_id);
  if (!session || session.closed_at_ms !== null) {
    return { ok: false, code: "session_closed" };
  }
  if (params.now_ms - session.created_at_ms > params.config.maxSessionSeconds * 1000) {
    closeSessionWithStores(params.app_session_id, params.now_ms, sessionsById);
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

function canRefreshTokensWithStores(
  params: {
    app_session_id: string;
    hashed_install_id: string;
    now_ms: number;
  },
  sessionsById: Map<string, SessionRecord>,
): LimitResult {
  const session = sessionsById.get(params.app_session_id);
  if (!session || session.closed_at_ms !== null) {
    return { ok: false, code: "session_closed" };
  }
  if (session.hashed_install_id !== params.hashed_install_id) {
    return { ok: false, code: "session_install_mismatch" };
  }
  if (params.now_ms - session.created_at_ms > defaultRateLimits.maxSessionSeconds * 1000) {
    closeSessionWithStores(params.app_session_id, params.now_ms, sessionsById);
    return { ok: false, code: "session_expired" };
  }
  return { ok: true };
}

function endTranslationWithStores(
  appSessionId: string,
  sessionsById: Map<string, SessionRecord>,
): void {
  const session = sessionsById.get(appSessionId);
  if (session) {
    session.in_flight_translations = Math.max(0, session.in_flight_translations - 1);
  }
}

function closeSessionWithStores(
  appSessionId: string,
  nowMs: number,
  sessionsById: Map<string, SessionRecord>,
): void {
  const session = sessionsById.get(appSessionId);
  if (session && session.closed_at_ms === null) {
    session.closed_at_ms = nowMs;
    session.in_flight_translations = 0;
  }
}

function closeExpiredSessionsWithStores(
  config: typeof defaultRateLimits,
  nowMs: number,
  sessionsById: Map<string, SessionRecord>,
): void {
  for (const session of sessionsById.values()) {
    if (
      session.closed_at_ms === null &&
      nowMs - session.created_at_ms > config.maxSessionSeconds * 1000
    ) {
      session.closed_at_ms = nowMs;
      session.in_flight_translations = 0;
    }
  }
}

function pruneInstallStartsWithStores(
  hashedInstallId: string,
  nowMs: number,
  startsByInstall: Map<string, number[]>,
): void {
  startsByInstall.set(
    hashedInstallId,
    (startsByInstall.get(hashedInstallId) ?? []).filter(
      (timestamp) => timestamp >= nowMs - 24 * 60 * 60 * 1000,
    ),
  );
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

function pruneState(state: DurableLimitState, nowMs: number): void {
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

function listReportInboxMemory(limit: number): ReportInboxRecord[] {
  pruneReportInboxMemory(Date.now());
  return reportInboxOrder
    .slice(0, Math.max(1, Math.min(200, limit)))
    .map((reportId) => reportInboxById.get(reportId))
    .filter((report): report is ReportInboxRecord => Boolean(report));
}

function deleteReportInboxMemory(reportId: string): { deleted: boolean } {
  const deleted = reportInboxById.delete(reportId);
  const existingIndex = reportInboxOrder.indexOf(reportId);
  if (existingIndex >= 0) {
    reportInboxOrder.splice(existingIndex, 1);
  }
  return { deleted };
}

function pruneReportInboxMemory(nowMs: number): void {
  pruneReportInboxWithStores(nowMs, reportInboxById, reportInboxOrder);
}

function pruneReportInboxState(state: DurableLimitState, nowMs: number): void {
  const inboxById = new Map(Object.entries(state.report_inbox_by_id ?? {}));
  const inboxOrder = [...(state.report_inbox_order ?? [])];
  pruneReportInboxWithStores(nowMs, inboxById, inboxOrder);
  state.report_inbox_by_id = Object.fromEntries(inboxById);
  state.report_inbox_order = inboxOrder;
}

function pruneReportInboxWithStores(
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

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}
