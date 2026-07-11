import {
  beginSummary,
  beginTranslation,
  canRefreshTokens,
  canCreateSession,
  closeSession,
  createSessionRecord,
  defaultRateLimits,
  endSummary,
  endTranslation,
  getSession,
  type LimitResult,
} from "../limits";
import { canAcceptReportWithStores, pruneReportInboxWithStores } from "./stateAdapter";
import type {
  AppAttestDeviceRecord,
  DurableLimitRequest,
  ReportInboxRecord,
} from "./types";

const reportTimestampsBySession = new Map<string, number[]>();
const reportInboxById = new Map<string, ReportInboxRecord>();
const reportInboxOrder: string[] = [];
const appAttestDevicesByKeyId = new Map<string, AppAttestDeviceRecord>();

export function callMemoryLimiter(body: DurableLimitRequest): unknown {
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
    case "begin_summary":
      return beginSummary({
        app_session_id: body.app_session_id,
        config: defaultRateLimits,
        now_ms: body.now_ms,
      });
    case "end_translation":
      endTranslation(body.app_session_id);
      return { ok: true };
    case "end_summary":
      endSummary(body.app_session_id);
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
