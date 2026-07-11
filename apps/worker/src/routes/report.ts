import type { Env } from "../env";
import { json } from "../http/response";
import { logWorkerEvent } from "../privacy";
import {
  canAcceptReportDurable,
  deleteReportDurable,
  listReportsDurable,
  storeReportDurable,
} from "../rateLimitDurableObject";
import {
  forwardReport,
  parseTranslationReport,
  type TranslationReportReceipt,
} from "../report";

export async function createReport(request: Request, env: Env): Promise<Response> {
  const body = await request.json().catch(() => null);
  const report = parseTranslationReport(body);
  if ("error" in report) {
    return json({ error: report.error }, 400);
  }

  const nowMs = Date.now();
  const reportLimit = await canAcceptReportDurable({
    app_session_id: report.app_session_id,
    namespace: env.RATE_LIMITER,
    now_ms: nowMs,
  });
  if (!reportLimit.ok) {
    return json(
      { error: reportLimit.code },
      reportLimit.code === "report_rate_limited" ? 429 : 409,
    );
  }

  const receipt: TranslationReportReceipt = {
    created_at_ms: nowMs,
    report_id: crypto.randomUUID(),
    retained_text_snapshot: Boolean(
      report.optional_source_text_snapshot || report.optional_translated_text_snapshot,
    ),
  };

  await storeReportDurable({
    namespace: env.RATE_LIMITER,
    report: {
      app_session_id: report.app_session_id,
      created_at_ms: receipt.created_at_ms,
      error_category: report.error_category,
      provider_metadata: report.provider_metadata,
      report_id: receipt.report_id,
      retained_text_snapshot: receipt.retained_text_snapshot,
      revision: report.revision,
      source_language: report.source_language,
      span_id: report.span_id,
      target_language: report.target_language,
    },
  });

  const forwardResult = await forwardReport({
    report,
    reportWebhookUrl: env.REPORT_WEBHOOK_URL,
    receipt,
  });
  if (!forwardResult.ok) {
    logWorkerEvent({
      event: "translation_report_forward_failed",
      app_session_id: report.app_session_id,
      report_id: receipt.report_id,
      reason: forwardResult.reason,
      at_ms: nowMs,
    });
  }

  logWorkerEvent({
    event: "translation_reported",
    app_session_id: report.app_session_id,
    report_id: receipt.report_id,
    span_id: report.span_id,
    revision: report.revision,
    error_category: report.error_category,
    retained_text_snapshot: receipt.retained_text_snapshot,
    at_ms: nowMs,
  });

  return json({ ok: true, ...receipt }, 202);
}

export async function listReports(request: Request, env: Env): Promise<Response> {
  const adminResponse = requireReportAdmin(request, env);
  if (adminResponse) {
    return adminResponse;
  }

  const url = new URL(request.url);
  const limit = Number(url.searchParams.get("limit") ?? "50");
  const reports = await listReportsDurable({
    limit: Number.isFinite(limit) ? limit : 50,
    namespace: env.RATE_LIMITER,
  });
  return json({ reports });
}

export async function deleteReport(
  request: Request,
  env: Env,
  reportId: string | undefined,
): Promise<Response> {
  const adminResponse = requireReportAdmin(request, env);
  if (adminResponse) {
    return adminResponse;
  }
  if (!reportId) {
    return json({ error: "invalid_report_id" }, 400);
  }
  const result = await deleteReportDurable({
    namespace: env.RATE_LIMITER,
    report_id: reportId,
  });
  return json(result, result.deleted ? 200 : 404);
}

function requireReportAdmin(request: Request, env: Env): Response | null {
  if (!env.REPORT_ADMIN_TOKEN) {
    return json({ error: "report_admin_unconfigured" }, 503);
  }
  const authorization = request.headers.get("Authorization") ?? "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice("Bearer ".length) : "";
  if (!timingSafeEqual(token, env.REPORT_ADMIN_TOKEN)) {
    return json({ error: "unauthorized" }, 401);
  }
  return null;
}

function timingSafeEqual(left: string, right: string): boolean {
  const leftBytes = new TextEncoder().encode(left);
  const rightBytes = new TextEncoder().encode(right);
  const length = Math.max(leftBytes.length, rightBytes.length);
  let diff = leftBytes.length ^ rightBytes.length;
  for (let index = 0; index < length; index += 1) {
    diff |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  }
  return diff === 0;
}
