/// <reference types="@cloudflare/workers-types" />

export type Env = {
  APPLE_APP_ATTEST_APP_ID?: string;
  APPLE_APP_ATTEST_ENVIRONMENT?: string;
  CARTESIA_API_KEY?: string;
  CARTESIA_VERSION?: string;
  DEEPGRAM_API_KEY?: string;
  GOOGLE_PLAY_INTEGRITY_ACCESS_TOKEN?: string;
  GOOGLE_PLAY_INTEGRITY_REQUIRED_DEVICE_VERDICT?: string;
  GOOGLE_PLAY_PACKAGE_NAME?: string;
  GOOGLE_SERVICE_ACCOUNT_EMAIL?: string;
  GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?: string;
  GROQ_API_KEY?: string;
  MURMUR_ENABLE_SPEECH?: string;
  MURMUR_ENV?: string;
  MURMUR_REQUIRE_DEVICE_INTEGRITY?: string;
  OPENROUTER_API_KEY?: string;
  OPENROUTER_APP_NAME?: string;
  OPENROUTER_MODEL?: string;
  OPENROUTER_PROVIDER_ALLOW_FALLBACKS?: string;
  OPENROUTER_PROVIDER_DATA_COLLECTION?: string;
  OPENROUTER_PROVIDER_IGNORE?: string;
  OPENROUTER_PROVIDER_ONLY?: string;
  OPENROUTER_PROVIDER_ORDER?: string;
  OPENROUTER_PROVIDER_REQUIRE_PARAMETERS?: string;
  OPENROUTER_PROVIDER_SORT?: string;
  OPENROUTER_PROVIDER_ZDR?: string;
  OPENROUTER_SITE_URL?: string;
  OPENROUTER_TIMEOUT_MS?: string;
  OPENROUTER_SUMMARY_MODEL?: string;
  ULTRAVOX_API_KEY?: string;
  ULTRAVOX_MODEL?: string;
  RATE_LIMITER?: DurableObjectNamespace;
  CARTESIA_DEFAULT_VOICE_ID?: string;
  CARTESIA_VOICE_ID_BY_LANGUAGE?: string;
  REPORT_WEBHOOK_URL?: string;
  REPORT_ADMIN_TOKEN?: string;
  SESSION_HASH_SALT?: string;
  TOKEN_TTL_SECONDS?: string;
};

export type WorkerReadiness = {
  env: string;
  missing: {
    optional: string[];
    required: string[];
  };
  ok: boolean;
  providers: {
    cartesia_speech: "configured" | "disabled" | "missing_optional";
    deepgram_stt: "configured" | "missing_required";
    openrouter_translation: "configured" | "missing_required";
    report_webhook: "configured" | "missing_optional";
  };
};

export function getReadiness(env: Env): WorkerReadiness {
  const required = [
    !env.DEEPGRAM_API_KEY ? "DEEPGRAM_API_KEY" : null,
    !env.OPENROUTER_API_KEY ? "OPENROUTER_API_KEY" : null,
    env.MURMUR_ENV === "production" && !env.SESSION_HASH_SALT ? "SESSION_HASH_SALT" : null,
  ].filter((item): item is string => Boolean(item));
  const speechEnabled = isSpeechEnabled(env);
  const optional = [
    speechEnabled && !env.CARTESIA_API_KEY ? "CARTESIA_API_KEY" : null,
    speechEnabled && !env.CARTESIA_DEFAULT_VOICE_ID && !env.CARTESIA_VOICE_ID_BY_LANGUAGE
      ? "CARTESIA_DEFAULT_VOICE_ID_OR_CARTESIA_VOICE_ID_BY_LANGUAGE"
      : null,
    !env.REPORT_WEBHOOK_URL && !env.REPORT_ADMIN_TOKEN ? "REPORT_WEBHOOK_URL_OR_REPORT_ADMIN_TOKEN" : null,
  ].filter((item): item is string => Boolean(item));

  return {
    env: env.MURMUR_ENV ?? "development",
    missing: {
      optional,
      required,
    },
    ok: required.length === 0,
    providers: {
      cartesia_speech: speechEnabled
        ? env.CARTESIA_API_KEY && (env.CARTESIA_DEFAULT_VOICE_ID || env.CARTESIA_VOICE_ID_BY_LANGUAGE)
          ? "configured"
          : "missing_optional"
        : "disabled",
      deepgram_stt: env.DEEPGRAM_API_KEY ? "configured" : "missing_required",
      openrouter_translation: env.OPENROUTER_API_KEY ? "configured" : "missing_required",
      report_webhook: env.REPORT_WEBHOOK_URL || env.REPORT_ADMIN_TOKEN ? "configured" : "missing_optional",
    },
  };
}

export function requiresDeviceIntegrity(env: Env): boolean {
  return env.MURMUR_REQUIRE_DEVICE_INTEGRITY === "true";
}

export function isSpeechEnabled(env: Env): boolean {
  return env.MURMUR_ENABLE_SPEECH !== "false";
}
