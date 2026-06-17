/// <reference types="@cloudflare/workers-types" />

import {
  defaultRateLimits,
  type LimitResult,
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
      case "begin_summary":
        return adapter.beginSummary({
          app_session_id: body.app_session_id,
          config: defaultRateLimits,
          now_ms: body.now_ms,
        });
      case "end_translation":
        adapter.endTranslation(body.app_session_id);
        return { ok: true };
      case "end_summary":
        adapter.endSummary(body.app_session_id);
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
      (await this.state.storage.get<DurableLimitState>(stateKey)) ?? createEmptyDurableLimitState()
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

export async function beginSummaryDurable(params: {
  app_session_id: string;
  namespace?: DurableObjectNamespace;
  now_ms: number;
}): Promise<LimitResult> {
  return (await callRateLimiter(params.namespace, {
    action: "begin_summary",
    app_session_id: params.app_session_id,
    now_ms: params.now_ms,
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

export async function endSummaryDurable(params: {
  app_session_id: string;
  namespace?: DurableObjectNamespace;
}): Promise<void> {
  await callRateLimiter(params.namespace, {
    action: "end_summary",
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

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}
