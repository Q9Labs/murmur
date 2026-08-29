import {
  canCreateSession,
  closeSession,
  createSessionRecord,
  defaultRateLimits,
  getSession,
  type LimitResult,
  reserveRealtimeSession,
} from "../limits";
import {
  canAcceptReportWithStores,
  canAcceptTelemetryWithStores,
  pruneReportInboxWithStores,
} from "./stateAdapter";
import type {
  AppAttestDeviceRecord,
  DurableLimitRequest,
  ReportInboxRecord,
} from "./types";

const reportTimestampsBySession = new Map<string, number[]>();
const reportInboxById = new Map<string, ReportInboxRecord>();
const reportInboxOrder: string[] = [];
const appAttestDevicesByKeyId = new Map<string, AppAttestDeviceRecord>();
const telemetryTimestampsByClient = new Map<string, number[]>();

export function callMemoryLimiter(body: DurableLimitRequest): unknown {
  switch (body.action) {
    case "create_session_record":
      return createMemorySessionRecord(body);
    case "close_session":
      closeSession(body.app_session_id, body.now_ms);
      return { ok: true };
    case "reserve_realtime_session":
      return reserveRealtimeSession({
        app_session_id: body.app_session_id,
        config: defaultRateLimits,
        now_ms: body.now_ms,
      });
    case "can_accept_report":
      return canAcceptReportMemory(body.app_session_id, body.now_ms);
    case "can_accept_telemetry":
      return canAcceptTelemetryWithStores(
        body.hashed_client_id,
        body.now_ms,
        telemetryTimestampsByClient,
      );
    case "store_report":
      reportInboxById.set(body.report.report_id, body.report);
      reportInboxOrder.unshift(body.report.report_id);
      pruneReportInboxMemory(Date.now());
      return { ok: true };
    case "list_reports":
      return listReportInboxMemory(body.limit);
    case "delete_report":
      return deleteReportInboxMemory(body.report_id);
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

function createMemorySessionRecord(
  body: Extract<DurableLimitRequest, { action: "create_session_record" }>,
): LimitResult | ReturnType<typeof createSessionRecord> {
  if (body.enforce_limits) {
    const limit = canCreateSession({
      config: defaultRateLimits,
      hashed_install_id: body.hashed_install_id,
      now_ms: body.now_ms,
    });
    if (!limit.ok) {
      return limit;
    }
  }
  const record = createSessionRecord({
    app_session_id: body.app_session_id,
    hashed_install_id: body.hashed_install_id,
    now_ms: body.now_ms,
  });
  return body.enforce_limits ? { ok: true } : record;
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
