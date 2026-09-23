import {
  normalizeAcquisitionContext,
  type AcquisitionContext,
} from "@murmur/protocol/acquisition";
import type { LanguageCode, SourceLanguageCode } from "@murmur/protocol/languages";

import { getMurmurSession } from "../auth/auth";
import { currentCustomerPlan, ensureCurrentAllowance, type CustomerPlan } from "../billing/allowanceService";
import { callCustomerLedger } from "../billing/customerLedgerDurableObject";
import { freeAllowanceClaimHashFromRequest } from "../billing/freeAllowanceClaims";
import { queuePersonalOfferStart } from "../billing/personalOffer";
import { getPhoneAudioGift, openPhoneAudioGiftSession } from "../billing/phoneAudioGift";
import {
  type Env,
  getReadiness,
  getRealtimeApiKey,
  isBillingEnforced,
} from "../env";
import { json } from "../http/response";
import { verifyPlayIntegrityIfRequired } from "../playIntegrity";
import { hashInstallId, logWorkerEvent } from "../privacy";
import {
  queuePostHogEvent,
  type TelemetryExecutionContext,
} from "../observability/posthog";
import {
  closeSessionDurable,
  createSessionIfAllowedDurable,
  isRateLimiterUnavailable,
} from "../rateLimitDurableObject";
import { parseLanguagePair } from "../translation/validation";
import { getServerConfig, isBelowMinimumVersion, sessionLimitSeconds, type ServerConfig } from "../serverConfig";

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
  const authorized = await prepareConfiguredSession(request, parsed.value, env, nowMs);
  if (!authorized.ok) {
    return authorized.response;
  }
  const config = authorized.config;
  const maxSessionSeconds = sessionLimitSeconds(config, authorized.plan);
  const phoneAudio = await authorizePhoneAudio(request, env, parsed.value.captureSource, authorized.plan);
  if (!phoneAudio.ok) {
    return phoneAudio.response;
  }

  const appSessionId = crypto.randomUUID();
  const limitResult = await createSessionIfAllowedDurable({
    app_session_id: appSessionId,
    hashed_install_id: authorized.hashedInstallId,
    max_session_seconds: maxSessionSeconds,
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
    config,
    authorized.plan,
    maxSessionSeconds,
    context,
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
  if (phoneAudio.giftCustomerId && env.BILLING_DB) {
    try {
      await openPhoneAudioGiftSession(env.BILLING_DB, phoneAudio.giftCustomerId, appSessionId);
    } catch (failure) {
      await callCustomerLedger(env.CUSTOMER_LEDGER, phoneAudio.giftCustomerId, {
        action: "close_usage_session",
        customerId: phoneAudio.giftCustomerId,
        nowMs: Date.now(),
        outcome: "failed",
        usageSessionId: appSessionId,
      });
      await closeSessionDurable({ app_session_id: appSessionId, namespace: env.RATE_LIMITER, now_ms: Date.now() });
      throw failure;
    }
  }
  logWorkerEvent({
    acquisition: parsed.value.acquisition ?? null,
    event: "session_created",
    app_session_id: appSessionId,
    device_integrity_available: parsed.value.deviceIntegrity.available,
    device_integrity_platform: parsed.value.deviceIntegrity.platform,
    device_integrity_provider: parsed.value.deviceIntegrity.provider,
    device_integrity_verified: authorized.requestHashVerified,
    capture_source: parsed.value.captureSource,
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
        capture_source: parsed.value.captureSource,
        event: "worker_session_created",
        source_language: parsed.value.sourceLanguage,
        target_language: parsed.value.targetLanguage,
      },
    });
  }

  return json({
    app_session_id: appSessionId,
    features: { source_transcript: config.source_transcript },
    limits: {
      expires_at_ms: nowMs + sessionDurationMs,
      max_session_seconds: Math.floor(sessionDurationMs / 1_000),
    },
    realtime_ws_url: realtimeUrl(
      request.url,
      appSessionId,
      parsed.value.targetLanguage,
      parsed.value.analyticsEnabled,
      parsed.value.playbackEnabled,
      parsed.value.appPlatform,
      parsed.value.appVersion,
    ),
    session_epoch: 1,
  });
}

async function prepareConfiguredSession(
  request: Request,
  parsed: ParsedCreateSessionRequest,
  env: Env,
  nowMs: number,
): Promise<
  | { config: ServerConfig; hashedInstallId: string; ok: true; plan: CustomerPlan; requestHashVerified: boolean }
  | { ok: false; response: Response }
> {
  const customerSession = await getMurmurSession(request, env);
  if (isBillingEnforced(env) && !customerSession) {
    return { ok: false, response: json({ error: "authentication_required" }, 401) };
  }
  const hashedInstallId = await hashInstallId(
    parsed.appInstallId,
    env.SESSION_HASH_SALT ?? "local-development-salt",
  );
  const plan = customerSession
    ? await currentCustomerPlan(env.BILLING_DB, customerSession.user.id, nowMs)
    : "free";
  const config = await getServerConfig(env, {
    appVersion: parsed.appVersion,
    distinctId: `anonymous_install_${hashedInstallId}`,
    plan,
    platform: parsed.appPlatform,
  });
  if (!config.sessions_enabled) {
    return {
      ok: false,
      response: json({ error: "sessions_disabled", message: config.sessions_disabled_message }, 503),
    };
  }
  const minimumVersion = minimumAppVersion(config, parsed.appPlatform);
  if (isBelowMinimumVersion(parsed.appVersion, minimumVersion)) {
    return {
      ok: false,
      response: json({ error: "app_version_unsupported", minimum_version: minimumVersion }, 426),
    };
  }
  const authorized = await authorizeCreateSession(
    parsed,
    env,
    nowMs,
    hashedInstallId,
    config.device_integrity_required,
  );
  return authorized.ok ? { ...authorized, config, plan } : authorized;
}

function minimumAppVersion(config: ServerConfig, platform: "android" | "ios" | null): string | null {
  if (platform === "ios") {
    return config.min_app_version_ios;
  }
  return platform === "android" ? config.min_app_version_android : null;
}

async function authorizePhoneAudio(
  request: Request,
  env: Env,
  captureSource: ParsedCreateSessionRequest["captureSource"],
  plan: CustomerPlan,
): Promise<{ ok: true; giftCustomerId: string | null } | { ok: false; response: Response }> {
  if (captureSource !== "phone_audio" || plan !== "free") {
    return { ok: true, giftCustomerId: null };
  }
  const session = await getMurmurSession(request, env);
  if (!session) {
    return { ok: false, response: json({ error: "authentication_required" }, 401) };
  }
  if (!env.BILLING_DB) {
    return { ok: false, response: json({ error: "billing_unavailable" }, 503) };
  }
  const gift = await getPhoneAudioGift(env.BILLING_DB, session.user.id);
  if (gift.remaining_ms <= 0) {
    return { ok: false, response: json({ error: "feature_requires_pro" }, 403) };
  }
  return { ok: true, giftCustomerId: session.user.id };
}

export async function prepareBillingUsage(
  request: Request,
  env: Env,
  usageSessionId: string,
  nowMs: number,
  config: ServerConfig,
  plan: CustomerPlan,
  maxSessionSeconds: number,
  context?: TelemetryExecutionContext,
): Promise<
  | { ok: true; sessionDurationMs: number }
  | { ok: false; response: Response }
> {
  const defaultDurationMs = maxSessionSeconds * 1_000;
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
    freeAllowanceMinutes: config.free_allowance_minutes,
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
    maxSessionSeconds,
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
    if (plan === "free") {
      queuePersonalOfferStart({
        config,
        context,
        customerId: customerSession.user.id,
        database: env.BILLING_DB,
        nowMs,
      });
    }
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
  appPlatform: "android" | "ios" | null;
  appVersion: string | null;
  captureSource: "microphone" | "phone_audio";
  deviceIntegrity: ReturnType<typeof parseDeviceIntegrity>;
  playbackEnabled: boolean;
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
  if (body.playback_enabled !== undefined && typeof body.playback_enabled !== "boolean") {
    return { ok: false, response: json({ error: "invalid_playback_enabled" }, 400) };
  }
  if (body.capture_source !== undefined && body.capture_source !== "microphone" && body.capture_source !== "phone_audio") {
    return { ok: false, response: json({ error: "invalid_capture_source" }, 400) };
  }
  const languagePair = parseLanguagePair(body.source_language, body.target_language);
  if ("error" in languagePair) {
    return { ok: false, response: json({ error: languagePair.error }, 400) };
  }
  const deviceIntegrity = parseDeviceIntegrity(body.device_integrity);
  return {
    ok: true,
    value: {
      acquisition: normalizeAcquisitionContext(body.acquisition),
      analyticsEnabled: body.analytics_enabled === true,
      appInstallId: body.app_install_id,
      captureSource: body.capture_source === "phone_audio" ? "phone_audio" : "microphone",
      deviceIntegrity,
      appPlatform: parseAppPlatform(body.app_platform, deviceIntegrity.platform),
      appVersion: typeof body.app_version === "string" ? body.app_version : null,
      playbackEnabled: body.playback_enabled !== false,
      sourceLanguage: languagePair.sourceLanguage,
      targetLanguage: languagePair.targetLanguage,
    },
  };
}

function parseAppPlatform(explicit: unknown, integrityPlatform: string | null): "android" | "ios" | null {
  if (explicit === "android" || explicit === "ios") {
    return explicit;
  }
  return integrityPlatform === "android" || integrityPlatform === "ios" ? integrityPlatform : null;
}

async function authorizeCreateSession(
  parsed: ParsedCreateSessionRequest,
  env: Env,
  nowMs: number,
  hashedInstallId: string,
  integrityRequired: boolean,
): Promise<
  | { hashedInstallId: string; ok: true; requestHashVerified: boolean }
  | { ok: false; response: Response }
> {
  const integrityResult = await verifyPlayIntegrityIfRequired({
    device_integrity: parsed.deviceIntegrity,
    env,
    hashed_install_id: hashedInstallId,
    namespace: env.RATE_LIMITER,
    now_ms: nowMs,
    required: integrityRequired,
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
  const token = stringProperty(value, "token");
  return {
    available: "available" in value && value.available === true && Boolean(token && token.length > 20),
    key_id: stringProperty(value, "key_id"),
    kind: stringProperty(value, "kind"),
    nonce: stringProperty(value, "nonce"),
    platform: stringProperty(value, "platform") ?? null,
    provider: stringProperty(value, "provider") ?? null,
    token,
  };
}

function stringProperty(value: object, key: string): string | undefined {
  const property = Object.entries(value).find(([name]) => name === key)?.[1];
  return typeof property === "string" ? property : undefined;
}

function realtimeUrl(
  requestUrl: string,
  appSessionId: string,
  targetLanguage: LanguageCode,
  analyticsEnabled: boolean,
  playbackEnabled: boolean,
  appPlatform: "android" | "ios" | null,
  appVersion: string | null,
): string {
  const url = new URL(requestUrl);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = "/v2/realtime";
  url.search = new URLSearchParams({
    app_session_id: appSessionId,
    analytics_enabled: String(analyticsEnabled),
    playback_enabled: String(playbackEnabled),
    ...(appPlatform ? { app_platform: appPlatform } : {}),
    ...(appVersion ? { app_version: appVersion } : {}),
    target_language: targetLanguage,
  }).toString();
  return url.toString();
}
