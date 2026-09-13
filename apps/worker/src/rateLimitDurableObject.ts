/// <reference types="@cloudflare/workers-types" />

import {
  defaultRateLimits,
  type LimitResult,
  type RealtimeReservationResult,
  type SessionRecord,
} from "./limits";
import { callMemoryLimiter } from "./rateLimiter/memoryFallback";
import {
  createEmptyDurableLimitState,
  createMemoryAdapter,
  pruneState,
} from "./rateLimiter/stateAdapter";
import type {
  AppAttestDeviceRecord,
  DurableLimitRequest,
  DurableLimitState,
  ReportInboxRecord,
} from "./rateLimiter/types";

export type {
  AppAttestDeviceRecord,
  ReportInboxRecord,
} from "./rateLimiter/types";

const stateKey = "rate_limit_state_v1";
const rateLimiterInvalidResponseCode = "rate_limiter_invalid_response";
const rateLimiterUnavailableCode = "rate_limiter_unavailable";

export type RateLimiterNamespace = {
  get(id: DurableObjectId): { fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> };
  idFromName(name: string): DurableObjectId;
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
      case "create_session_record":
        return createSessionRecord(body, adapter);
      case "close_session":
        adapter.closeSession(body.app_session_id, body.now_ms);
        return { ok: true };
      case "reserve_realtime_session":
        return adapter.reserveRealtimeSession(body.app_session_id, body.now_ms);
      case "can_accept_report":
        return adapter.canAcceptReport(body.app_session_id, body.now_ms);
      case "can_accept_telemetry":
        return adapter.canAcceptTelemetry(body.hashed_client_id, body.now_ms);
      case "store_report":
        adapter.storeReport(body.report);
        return { ok: true };
      case "list_reports":
        return adapter.listReports(body.limit);
      case "delete_report":
        return adapter.deleteReport(body.report_id);
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
      (await this.state.storage.get<DurableLimitState>(stateKey)) ?? createEmptyDurableLimitState()
    );
  }

  private async saveState(state: DurableLimitState): Promise<void> {
    pruneState(state, Date.now());
    await this.state.storage.put(stateKey, state);
  }
}

function createSessionRecord(
  body: Extract<DurableLimitRequest, { action: "create_session_record" }>,
  adapter: ReturnType<typeof createMemoryAdapter>,
): LimitResult | SessionRecord {
  if (body.enforce_limits) {
    const limit = adapter.canCreateSession({
      config: defaultRateLimits,
      hashed_install_id: body.hashed_install_id,
      now_ms: body.now_ms,
    });
    if (!limit.ok) {
      return limit;
    }
  }
  const record = adapter.createSessionRecord({
    app_session_id: body.app_session_id,
    hashed_install_id: body.hashed_install_id,
    now_ms: body.now_ms,
  });
  return body.enforce_limits ? { ok: true } : record;
}

async function callRateLimiter(
  namespace: RateLimiterNamespace | undefined,
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
  if (!response.ok) {
    throw new Error(`Rate limiter request failed with status ${response.status}`);
  }
  return response.json();
}

async function callRateLimiterForLimit(
  namespace: RateLimiterNamespace | undefined,
  body: DurableLimitRequest,
): Promise<LimitResult> {
  try {
    return decodeLimitResult(await callRateLimiter(namespace, body));
  } catch {
    return { code: rateLimiterUnavailableCode, ok: false };
  }
}

function decodeLimitResult(result: unknown): LimitResult {
  if (typeof result !== "object") {
    return invalidRateLimiterResponse();
  }
  if (result === null) {
    return invalidRateLimiterResponse();
  }
  if (!("ok" in result)) {
    return invalidRateLimiterResponse();
  }
  if (result.ok === true) {
    return { ok: true };
  }
  if (result.ok !== false) {
    return invalidRateLimiterResponse();
  }
  const code = "code" in result ? result.code : undefined;
  const retryAfterMs = "retry_after_ms" in result ? result.retry_after_ms : undefined;
  return decodeRejectedLimit(code, retryAfterMs);
}

function decodeRejectedLimit(code: unknown, retryAfterMs: unknown): LimitResult {
  if (typeof code !== "string") {
    return invalidRateLimiterResponse();
  }
  if (typeof retryAfterMs === "number") {
    return { code, ok: false, retry_after_ms: retryAfterMs };
  }
  return { code, ok: false };
}

function invalidRateLimiterResponse(): LimitResult {
  return { code: rateLimiterInvalidResponseCode, ok: false };
}

export function isRateLimiterUnavailable(result: LimitResult): boolean {
  return !result.ok && (
    result.code === rateLimiterUnavailableCode || result.code === rateLimiterInvalidResponseCode
  );
}

export async function createSessionIfAllowedDurable(params: {
  app_session_id: string;
  hashed_install_id: string;
  namespace?: RateLimiterNamespace;
  now_ms: number;
}): Promise<LimitResult> {
  return callRateLimiterForLimit(params.namespace, {
    action: "create_session_record",
    app_session_id: params.app_session_id,
    enforce_limits: true,
    hashed_install_id: params.hashed_install_id,
    now_ms: params.now_ms,
  });
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

export async function reserveRealtimeSessionDurable(params: {
  app_session_id: string;
  namespace?: DurableObjectNamespace;
  now_ms: number;
}): Promise<RealtimeReservationResult> {
  return (await callRateLimiter(params.namespace, {
    action: "reserve_realtime_session",
    app_session_id: params.app_session_id,
    now_ms: params.now_ms,
  })) as RealtimeReservationResult;
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

export async function canAcceptTelemetryDurable(params: {
  hashed_client_id: string;
  namespace?: RateLimiterNamespace;
  now_ms: number;
}): Promise<LimitResult> {
  return callRateLimiterForLimit(params.namespace, {
    action: "can_accept_telemetry",
    hashed_client_id: params.hashed_client_id,
    now_ms: params.now_ms,
  });
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

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}
