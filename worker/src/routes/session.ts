import type { LanguageCode, SourceLanguageCode } from "../../../lib/languages";
import {
  isTranslationModelRoute,
  isUltravoxReplacementRoute,
} from "../../../lib/translationModelRoutes";
import type {
  TranslationMode,
  TranslationModelRoute,
} from "../../../lib/transport/types";
import {
  type Env,
  isSpeechEnabled,
  requiresDeviceIntegrity,
} from "../env";
import { json } from "../http/response";
import { defaultRateLimits } from "../limits";
import { verifyPlayIntegrityIfRequired } from "../playIntegrity";
import { hashInstallId, logWorkerEvent } from "../privacy";
import {
  createUltravoxCall,
  mintProviderTokens,
  selectCartesiaVoiceId,
  type UltravoxCallResult,
} from "../providers/tokens";
import {
  canCreateSessionDurable,
  canRefreshTokensDurable,
  createSessionRecordDurable,
} from "../rateLimitDurableObject";
import {
  parseLanguagePair,
  parseTranslationMode,
  parseTranslationModelRoute,
  validateTranslationModelRouteForEnv,
} from "../translation/validation";

export async function createSession(request: Request, env: Env): Promise<Response> {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const parsed = parseCreateSessionRequest(body, env);
  if (!parsed.ok) {
    return parsed.response;
  }

  const nowMs = Date.now();
  const admission = await authorizeCreateSession(parsed.value, env, nowMs);
  if (!admission.ok) {
    return admission.response;
  }

  const providers = await prepareCreateSessionProviders(parsed.value, env);
  if (!providers.ok) {
    return providers.response;
  }

  const appSessionId = crypto.randomUUID();
  await createSessionRecordDurable({
    app_session_id: appSessionId,
    hashed_install_id: admission.hashedInstallId,
    namespace: env.RATE_LIMITER,
    now_ms: nowMs,
  });
  logCreateSession(parsed.value, admission.requestHashVerified, appSessionId, nowMs);
  return buildCreateSessionResponse(request, appSessionId, parsed.value, providers);
}

type ParsedCreateSessionRequest = {
  appInstallId: string;
  deviceIntegrity: ReturnType<typeof parseDeviceIntegrity>;
  sourceLanguage: SourceLanguageCode;
  targetLanguage: LanguageCode;
  translationMode: TranslationMode;
  translationModelRoute: TranslationModelRoute;
  ultravoxVadEnabled: boolean;
  useUltravoxReplacement: boolean;
};

function parseCreateSessionRequest(
  body: Record<string, unknown> | null,
  env: Env,
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
  if (typeof body.translation_model_route !== "undefined" && !isTranslationModelRoute(body.translation_model_route)) {
    return { ok: false, response: json({ error: "invalid_translation_model_route" }, 400) };
  }
  const translationModelRoute = parseTranslationModelRoute(body.translation_model_route);
  const routeError = validateTranslationModelRouteForEnv(translationModelRoute, env);
  if (routeError) {
    return { ok: false, response: json({ error: routeError }, 400) };
  }
  return {
    ok: true,
    value: {
      appInstallId: body.app_install_id,
      deviceIntegrity: parseDeviceIntegrity(body.device_integrity),
      sourceLanguage: languagePair.sourceLanguage,
      targetLanguage: languagePair.targetLanguage,
      translationMode: parseTranslationMode(body.translation_mode),
      translationModelRoute,
      ultravoxVadEnabled: body.ultravox_vad_enabled !== false,
      useUltravoxReplacement: isUltravoxReplacementRoute(translationModelRoute),
    },
  };
}

async function authorizeCreateSession(
  parsed: ParsedCreateSessionRequest,
  env: Env,
  nowMs: number,
): Promise<{ ok: true; hashedInstallId: string; requestHashVerified: boolean } | { ok: false; response: Response }> {
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
    return { ok: false, response: json({ error: integrityResult.code }, integrityResult.status) };
  }

  const limitResult = await canCreateSessionDurable({
    hashed_install_id: hashedInstallId,
    namespace: env.RATE_LIMITER,
    now_ms: nowMs,
  });
  return limitResult.ok
    ? { ok: true, hashedInstallId, requestHashVerified: integrityResult.request_hash_verified }
    : { ok: false, response: json({ error: "rate_limited", code: limitResult.code }, 429) };
}

type CreateSessionProviders = {
  ok: true;
  speechVoiceId: string | null;
  tokenTtlSeconds: number;
  tokens: { cartesiaAccessToken: string | null; deepgramToken: string | null };
  ultravoxCall: UltravoxCallResult | null;
};

async function prepareCreateSessionProviders(
  parsed: ParsedCreateSessionRequest,
  env: Env,
): Promise<CreateSessionProviders | { ok: false; response: Response }> {
  const tokenTtlSeconds = Number(env.TOKEN_TTL_SECONDS ?? "120");
  const includeSpeechToken =
    !parsed.useUltravoxReplacement &&
    isSpeechEnabled(env) &&
    parsed.translationMode !== "continuous";
  const tokens = parsed.useUltravoxReplacement
    ? { ok: true as const, cartesiaAccessToken: null, deepgramToken: null }
    : await mintProviderTokens(env, tokenTtlSeconds, { includeCartesia: includeSpeechToken });
  if (!tokens.ok) {
    return { ok: false, response: json({ error: "provider_unconfigured", missing: tokens.missing }, 503) };
  }

  const ultravoxCall = await maybeCreateUltravoxCall(parsed, env);
  if (ultravoxCall && "error" in ultravoxCall) {
    const missing = ultravoxCall.error === "missing_ultravox_api_key" ? ["ULTRAVOX_API_KEY"] : undefined;
    return {
      ok: false,
      response: json({ error: missing ? "provider_unconfigured" : ultravoxCall.error, missing }, missing ? 503 : 502),
    };
  }

  return {
    ok: true,
    speechVoiceId: includeSpeechToken ? selectCartesiaVoiceId(env, parsed.targetLanguage) : null,
    tokenTtlSeconds,
    tokens,
    ultravoxCall,
  };
}

async function maybeCreateUltravoxCall(
  parsed: ParsedCreateSessionRequest,
  env: Env,
): Promise<UltravoxCallResult | { error: string } | null> {
  return parsed.useUltravoxReplacement
    ? createUltravoxCall({
        env,
        source_language: parsed.sourceLanguage,
        target_language: parsed.targetLanguage,
        vad_enabled: parsed.ultravoxVadEnabled,
      }).catch((error) => ({
        error: error instanceof Error ? error.message : "ultravox_call_failed",
      }))
    : null;
}

function logCreateSession(
  parsed: ParsedCreateSessionRequest,
  requestHashVerified: boolean,
  appSessionId: string,
  nowMs: number,
): void {
  logWorkerEvent({
    event: "session_created",
    app_session_id: appSessionId,
    device_integrity_available: parsed.deviceIntegrity.available,
    device_integrity_platform: parsed.deviceIntegrity.platform,
    device_integrity_provider: parsed.deviceIntegrity.provider,
    device_integrity_verified: requestHashVerified,
    source_language: parsed.sourceLanguage,
    target_language: parsed.targetLanguage,
    translation_model_route: parsed.translationModelRoute,
    at_ms: nowMs,
  });
}

function buildCreateSessionResponse(
  request: Request,
  appSessionId: string,
  parsed: ParsedCreateSessionRequest,
  providers: CreateSessionProviders,
): Response {
  return json({
    app_session_id: appSessionId,
    limits: {
      max_chars_per_span: defaultRateLimits.maxCharsPerSpan,
      max_session_seconds: defaultRateLimits.maxSessionSeconds,
      translated_spans_per_minute: defaultRateLimits.translatedSpansPerMinute,
    },
    session_epoch: 1,
    translation_model_route: parsed.translationModelRoute,
    translation_mode: parsed.translationMode,
    speech: {
      default_voice_id: providers.speechVoiceId,
      enabled: Boolean(providers.tokens.cartesiaAccessToken && providers.speechVoiceId),
    },
    tokens: {
      cartesia_access_token: providers.tokens.cartesiaAccessToken,
      deepgram_token: providers.tokens.deepgramToken,
      expires_at_ms: Date.now() + providers.tokenTtlSeconds * 1000,
      token_bundle_id: crypto.randomUUID(),
    },
    deepgram_ws_url: parsed.useUltravoxReplacement ? undefined : deepgramUrl(request.url, appSessionId, parsed.sourceLanguage),
    translate_ws_url: translateUrl(request.url),
    ultravox: providers.ultravoxCall
      ? {
          call_id: providers.ultravoxCall.call_id,
          join_url: providers.ultravoxCall.join_url,
          vad_enabled: parsed.ultravoxVadEnabled,
          vad_profile: providers.ultravoxCall.vad_profile,
        }
      : undefined,
  });
}

export async function refreshSessionTokens(
  request: Request,
  env: Env,
  appSessionId: string,
): Promise<Response> {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) {
    return json({ error: "invalid_json" }, 400);
  }
  if (typeof body.app_install_id !== "string" || body.app_install_id.length < 8) {
    return json({ error: "invalid_install_id" }, 400);
  }
  if (typeof body.app_session_id === "string" && body.app_session_id !== appSessionId) {
    return json({ error: "session_id_mismatch" }, 400);
  }
  if (
    typeof body.session_epoch !== "number" ||
    !Number.isInteger(body.session_epoch) ||
    body.session_epoch < 1
  ) {
    return json({ error: "invalid_session_epoch" }, 400);
  }

  const languagePair = parseLanguagePair(body.source_language, body.target_language);
  if ("error" in languagePair) {
    return json({ error: languagePair.error }, 400);
  }
  const { targetLanguage } = languagePair;
  const translationMode = parseTranslationMode(body.translation_mode);

  const nowMs = Date.now();
  const hashedInstallId = await hashInstallId(
    body.app_install_id,
    env.SESSION_HASH_SALT ?? "local-development-salt",
  );
  const deviceIntegrity = parseDeviceIntegrity(body.device_integrity);
  const integrityResult = await verifyPlayIntegrityIfRequired({
    device_integrity: deviceIntegrity,
    env,
    hashed_install_id: hashedInstallId,
    namespace: env.RATE_LIMITER,
    now_ms: nowMs,
    required: requiresDeviceIntegrity(env),
  });
  if (!integrityResult.ok) {
    return json({ error: integrityResult.code }, integrityResult.status);
  }

  const refreshLimit = await canRefreshTokensDurable({
    app_session_id: appSessionId,
    hashed_install_id: hashedInstallId,
    namespace: env.RATE_LIMITER,
    now_ms: nowMs,
  });
  if (!refreshLimit.ok) {
    return json({ error: refreshLimit.code }, 409);
  }

  const tokenTtlSeconds = Number(env.TOKEN_TTL_SECONDS ?? "120");
  const includeSpeechToken = isSpeechEnabled(env) && translationMode !== "continuous";
  const tokens = await mintProviderTokens(env, tokenTtlSeconds, {
    includeCartesia: includeSpeechToken,
  });
  if (!tokens.ok) {
    return json({ error: "provider_unconfigured", missing: tokens.missing }, 503);
  }

  const speechVoiceId = includeSpeechToken ? selectCartesiaVoiceId(env, targetLanguage) : null;
  logWorkerEvent({
    event: "session_tokens_refreshed",
    app_session_id: appSessionId,
    device_integrity_available: deviceIntegrity.available,
    device_integrity_platform: deviceIntegrity.platform,
    device_integrity_provider: deviceIntegrity.provider,
    device_integrity_verified: integrityResult.request_hash_verified,
    target_language: targetLanguage,
    at_ms: nowMs,
  });

  return json({
    app_session_id: appSessionId,
    session_epoch: body.session_epoch + 1,
    speech: {
      default_voice_id: speechVoiceId,
      enabled: Boolean(tokens.cartesiaAccessToken && speechVoiceId),
    },
    tokens: {
      cartesia_access_token: tokens.cartesiaAccessToken,
      deepgram_token: tokens.deepgramToken,
      expires_at_ms: Date.now() + tokenTtlSeconds * 1000,
      token_bundle_id: crypto.randomUUID(),
    },
    deepgram_ws_url: deepgramUrl(request.url, appSessionId, languagePair.sourceLanguage),
  });
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

function translateUrl(requestUrl: string): string {
  const url = new URL(requestUrl);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = "/v1/translate";
  url.search = "";
  return url.toString();
}

function deepgramUrl(requestUrl: string, appSessionId: string, sourceLanguage: SourceLanguageCode): string {
  const url = new URL(requestUrl);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = "/v1/deepgram";
  url.search = new URLSearchParams({
    app_session_id: appSessionId,
    source_language: sourceLanguage,
  }).toString();
  return url.toString();
}
