/// <reference types="@cloudflare/workers-types" />

export type Env = {
  APPLE_APP_ATTEST_APP_ID?: string;
  APPLE_APP_ATTEST_ENVIRONMENT?: string;
  GOOGLE_PLAY_INTEGRITY_ACCESS_TOKEN?: string;
  GOOGLE_PLAY_INTEGRITY_REQUIRED_DEVICE_VERDICT?: string;
  GOOGLE_PLAY_PACKAGE_NAME?: string;
  GOOGLE_SERVICE_ACCOUNT_EMAIL?: string;
  GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?: string;
  MURMUR_ENV?: string;
  MURMUR_REQUIRE_DEVICE_INTEGRITY?: string;
  OPENAI_API_KEY?: string;
  OPENAI_REALTIME_MODEL?: string;
  RATE_LIMITER?: DurableObjectNamespace;
  REPORT_WEBHOOK_URL?: string;
  REPORT_ADMIN_TOKEN?: string;
  SESSION_HASH_SALT?: string;
};

export type WorkerReadiness = {
  env: string;
  missing: {
    optional: string[];
    required: string[];
  };
  ok: boolean;
  providers: {
    realtime_translation: "configured" | "missing_required";
    report_webhook: "configured" | "missing_optional";
  };
};

export function getReadiness(env: Env): WorkerReadiness {
  const required = [
    !env.OPENAI_API_KEY ? "OPENAI_API_KEY" : null,
    env.MURMUR_ENV === "production" && !env.SESSION_HASH_SALT ? "SESSION_HASH_SALT" : null,
  ].filter((item): item is string => Boolean(item));
  const optional = [
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
      realtime_translation: env.OPENAI_API_KEY ? "configured" : "missing_required",
      report_webhook: env.REPORT_WEBHOOK_URL || env.REPORT_ADMIN_TOKEN ? "configured" : "missing_optional",
    },
  };
}

export function requiresDeviceIntegrity(env: Env): boolean {
  return env.MURMUR_REQUIRE_DEVICE_INTEGRITY === "true";
}
