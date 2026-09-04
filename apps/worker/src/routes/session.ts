import {
  normalizeAcquisitionContext,
  type AcquisitionContext,
} from "@murmur/protocol/acquisition";
import type { LanguageCode, SourceLanguageCode } from "@murmur/protocol/languages";

import { getMurmurSession } from "../auth/auth";
import { ensureCurrentAllowance } from "../billing/allowanceService";
import { callCustomerLedger } from "../billing/customerLedgerDurableObject";
import { freeAllowanceClaimHashFromRequest } from "../billing/freeAllowanceClaims";
import {
  type Env,
  getReadiness,
  getRealtimeApiKey,
  isBillingEnforced,
  requiresDeviceIntegrity,
} from "../env";
import { json } from "../http/response";
import { defaultRateLimits } from "../limits";
import { verifyPlayIntegrityIfRequired } from "../playIntegrity";
import { hashInstallId, logWorkerEvent } from "../privacy";
import { queuePostHogEvent, type TelemetryExecutionContext } from "../observability/posthog";
import {
  closeSessionDurable,
  createSessionIfAllowedDurable,
  isRateLimiterUnavailable,
} from "../rateLimitDurableObject";
import { parseLanguagePair } from "../translation/validation";

export async function createSession(
  request: Request,
  env: Env,
  context?: TelemetryExecutionContext,
): Promise<Response> {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const parsed = parseCreateSessionRequest(body);
  if (!parsed.ok) {
    return parsed.response;
  }
  if (!getRealtimeApiKey(env)) {
    return json({ error: "provider_unconfigured", missing: getReadiness(env).missing.required }, 503);
  }

  const nowMs = Date.now();
  const authorized = await authorizeCreateSession(parsed.value, env, nowMs);
  if (!authorized.ok) {
    return authorized.response;
  }

  const appSessionId = crypto.randomUUID();
  const limitResult = await createSessionIfAllowedDurable({
    app_session_id: appSessionId,
    hashed_install_id: authorized.hashedInstallId,
    namespace: env.RATE_LIMITER,
    now_ms: nowMs,
  });
  if (!limitResult.ok) {
    if (isRateLimiterUnavailable(limitResult)) {
      return json({ error: "service_unavailable", code: limitResult.code }, 503);
    }
    return json({ error: "rate_limited", code: limitResult.code }, 429);
  }
  const billingUsage = await prepareBillingUsage(
    request,
    env,
    appSessionId,
    nowMs,
  );
  if (!billingUsage.ok) {
    await closeSessionDurable({
      app_session_id: appSessionId,
      namespace: env.RATE_LIMITER,
      now_ms: Date.now(),
    });
    return billingUsage.response;
  }
  const sessionDurationMs = billingUsage.sessionDurationMs;
  logWorkerEvent({
    acquisition: parsed.value.acquisition ?? null,
    event: "session_created",
    app_session_id: appSessionId,
    device_integrity_available: parsed.value.deviceIntegrity.available,
    device_integrity_platform: parsed.value.deviceIntegrity.platform,
    device_integrity_provider: parsed.value.deviceIntegrity.provider,
    device_integrity_verified: authorized.requestHashVerified,
    hashed_install_id: authorized.hashedInstallId,
    source_language: parsed.value.sourceLanguage,
    target_language: parsed.value.targetLanguage,
    at_ms: nowMs,
  });
  if (parsed.value.analyticsEnabled) {
    queuePostHogEvent({
      context,
      distinct_id: `anonymous_install_${authorized.hashedInstallId}`,
      env,
      payload: {
        acquisition_campaign: parsed.value.acquisition?.campaign,
        acquisition_content: parsed.value.acquisition?.content,
        acquisition_landing: parsed.value.acquisition?.landing,
        acquisition_medium: parsed.value.acquisition?.medium,
        acquisition_partner: parsed.value.acquisition?.partner,
        acquisition_source: parsed.value.acquisition?.source,
        app_session_id: appSessionId,
        device_integrity_available: parsed.value.deviceIntegrity.available,
        device_integrity_platform: parsed.value.deviceIntegrity.platform,
        device_integrity_provider: parsed.value.deviceIntegrity.provider,
        device_integrity_verified: authorized.requestHashVerified,
        event: "worker_session_created",
        source_language: parsed.value.sourceLanguage,
        target_language: parsed.value.targetLanguage,
      },
    });
  }

  return json({
    app_session_id: appSessionId,
    limits: {
      expires_at_ms: nowMs + sessionDurationMs,
      max_session_seconds: Math.floor(sessionDurationMs / 1_000),
    },
    realtime_ws_url: realtimeUrl(
      request.url,
      appSessionId,
      parsed.value.targetLanguage,
      parsed.value.analyticsEnabled,
    ),
    session_epoch: 1,
  });
}

async function prepareBillingUsage(
  request: Request,
  env: Env,
  usageSessionId: string,
  nowMs: number,
): Promise<
  | { ok: true; sessionDurationMs: number }
  | { ok: false; response: Response }
> {
  const defaultDurationMs = defaultRateLimits.maxSessionSeconds * 1_000;
  if (!isBillingEnforced(env)) {
    return { ok: true, sessionDurationMs: defaultDurationMs };
  }
  const customerSession = await getMurmurSession(request, env);
  if (!customerSession) {
    return { ok: false, response: json({ error: "authentication_required" }, 401) };
  }
  const freeClaimHash = await freeAllowanceClaimHashFromRequest(request, env);
  const bootstrap = await ensureCurrentAllowance({
    customerId: customerSession.user.id,
    env,
    freeClaimHash,
    nowMs,
    principalProvider: customerSession.user.isAnonymous === true ? "anonymous" : "email",
  });
  if (!bootstrap.result.ok) {
    return {
      ok: false,
      response: json({ error: bootstrap.result.code }, bootstrap.response.status),
    };
  }
  const usage = await callCustomerLedger(env.CUSTOMER_LEDGER, customerSession.user.id, {
    action: "open_usage_session",
    customerId: customerSession.user.id,
    nowMs,
    usageSessionId,
  });
  if (!usage.result.ok || !("balance" in usage.result)) {
    return {
      ok: false,
      response: json(
        { error: usage.result.ok ? "billing_unavailable" : usage.result.code },
        usage.response.status,
      ),
    };
  }
  if (usage.result.balance.availableMs < 1_000) {
    await callCustomerLedger(env.CUSTOMER_LEDGER, customerSession.user.id, {
      action: "close_usage_session",
      customerId: customerSession.user.id,
      nowMs: Date.now(),
      outcome: "failed",
      usageSessionId,
    });
    return { ok: false, response: json({ error: "allowance_exhausted" }, 402) };
  }
  return { ok: true, sessionDurationMs: defaultDurationMs };
}

type ParsedCreateSessionRequest = {
  acquisition?: AcquisitionContext;
  analyticsEnabled: boolean;
  appInstallId: string;
  deviceIntegrity: ReturnType<typeof parseDeviceIntegrity>;
  sourceLanguage: SourceLanguageCode;
  targetLanguage: LanguageCode;
};

function parseCreateSessionRequest(
  body: Record<string, unknown> | null,
): { ok: true; value: ParsedCreateSessionRequest } | { ok: false; response: Response } {
  if (!body) {
    return { ok: false, response: json({ error: "invalid_json" }, 400) };
  }
  if (typeof body.app_install_id !== "string" || body.app_install_id.length < 8) {
    return { ok: false, response: json({ error: "invalid_install_id" }, 400) };
  }
  const languagePair = parseLanguagePair(body.source_language, body.target_language);
  if ("error" in languagePair) {
    return { ok: false, response: json({ error: languagePair.error }, 400) };
  }
  return {
    ok: true,
    value: {
      acquisition: normalizeAcquisitionContext(body.acquisition),
      analyticsEnabled: body.analytics_enabled === true,
      appInstallId: body.app_install_id,
      deviceIntegrity: parseDeviceIntegrity(body.device_integrity),
      sourceLanguage: languagePair.sourceLanguage,
      targetLanguage: languagePair.targetLanguage,
    },
  };
}

async function authorizeCreateSession(
  parsed: ParsedCreateSessionRequest,
  env: Env,
  nowMs: number,
): Promise<
  | { hashedInstallId: string; ok: true; requestHashVerified: boolean }
  | { ok: false; response: Response }
> {
  const hashedInstallId = await hashInstallId(
    parsed.appInstallId,
    env.SESSION_HASH_SALT ?? "local-development-salt",
  );
  const integrityResult = await verifyPlayIntegrityIfRequired({
    device_integrity: parsed.deviceIntegrity,
    env,
    hashed_install_id: hashedInstallId,
    namespace: env.RATE_LIMITER,
    now_ms: nowMs,
    required: requiresDeviceIntegrity(env),
  });
  if (!integrityResult.ok) {
    return {
      ok: false,
      response: json({ error: integrityResult.code }, integrityResult.status),
    };
  }
  return {
    hashedInstallId,
    ok: true,
    requestHashVerified: integrityResult.request_hash_verified,
  };
}

function parseDeviceIntegrity(value: unknown): {
  available: boolean;
  platform: string | null;
  provider: string | null;
  key_id?: string;
  kind?: string;
  nonce?: string;
  token?: string;
} {
  if (typeof value !== "object" || value === null) {
    return { available: false, platform: null, provider: null };
  }
  const payload = value as Record<string, unknown>;
  return {
    available: payload.available === true && typeof payload.token === "string" && payload.token.length > 20,
    key_id: typeof payload.key_id === "string" ? payload.key_id : undefined,
    kind: typeof payload.kind === "string" ? payload.kind : undefined,
    nonce: typeof payload.nonce === "string" ? payload.nonce : undefined,
    platform: typeof payload.platform === "string" ? payload.platform : null,
    provider: typeof payload.provider === "string" ? payload.provider : null,
    token: typeof payload.token === "string" ? payload.token : undefined,
  };
}

function realtimeUrl(
  requestUrl: string,
  appSessionId: string,
  targetLanguage: LanguageCode,
  analyticsEnabled: boolean,
): string {
  const url = new URL(requestUrl);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = "/v2/realtime";
  url.search = new URLSearchParams({
    app_session_id: appSessionId,
    analytics_enabled: String(analyticsEnabled),
    target_language: targetLanguage,
  }).toString();
  return url.toString();
}
