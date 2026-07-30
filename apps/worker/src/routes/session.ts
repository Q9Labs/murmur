import type { LanguageCode, SourceLanguageCode } from "@murmur/protocol/languages";

import {
  type Env,
  requiresDeviceIntegrity,
} from "../env";
import { json } from "../http/response";
import { defaultRateLimits } from "../limits";
import { verifyPlayIntegrityIfRequired } from "../playIntegrity";
import { hashInstallId, logWorkerEvent } from "../privacy";
import {
  canCreateSessionDurable,
  createSessionRecordDurable,
} from "../rateLimitDurableObject";
import { parseLanguagePair } from "../translation/validation";

export async function createSession(request: Request, env: Env): Promise<Response> {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const parsed = parseCreateSessionRequest(body);
  if (!parsed.ok) {
    return parsed.response;
  }
  if (!env.OPENAI_API_KEY) {
    return json({ error: "provider_unconfigured", missing: ["OPENAI_API_KEY"] }, 503);
  }

  const nowMs = Date.now();
  const authorized = await authorizeCreateSession(parsed.value, env, nowMs);
  if (!authorized.ok) {
    return authorized.response;
  }

  const appSessionId = crypto.randomUUID();
  await createSessionRecordDurable({
    app_session_id: appSessionId,
    hashed_install_id: authorized.hashedInstallId,
    namespace: env.RATE_LIMITER,
    now_ms: nowMs,
  });
  logWorkerEvent({
    event: "session_created",
    app_session_id: appSessionId,
    device_integrity_available: parsed.value.deviceIntegrity.available,
    device_integrity_platform: parsed.value.deviceIntegrity.platform,
    device_integrity_provider: parsed.value.deviceIntegrity.provider,
    device_integrity_verified: authorized.requestHashVerified,
    source_language: parsed.value.sourceLanguage,
    target_language: parsed.value.targetLanguage,
    at_ms: nowMs,
  });

  return json({
    app_session_id: appSessionId,
    limits: {
      max_session_seconds: defaultRateLimits.maxSessionSeconds,
    },
    realtime_ws_url: realtimeUrl(request.url, appSessionId, parsed.value.targetLanguage),
    session_epoch: 1,
  });
}

type ParsedCreateSessionRequest = {
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
  const limitResult = await canCreateSessionDurable({
    hashed_install_id: hashedInstallId,
    namespace: env.RATE_LIMITER,
    now_ms: nowMs,
  });
  if (!limitResult.ok) {
    return {
      ok: false,
      response: json({ error: "rate_limited", code: limitResult.code }, 429),
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
): string {
  const url = new URL(requestUrl);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = "/v1/realtime";
  url.search = new URLSearchParams({
    app_session_id: appSessionId,
    target_language: targetLanguage,
  }).toString();
  return url.toString();
}
