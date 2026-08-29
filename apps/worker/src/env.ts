/// <reference types="@cloudflare/workers-types" />

export type Env = {
  APPLE_APP_ATTEST_APP_ID?: string;
  APPLE_APP_ATTEST_ENVIRONMENT?: string;
  BETTER_AUTH_SECRET?: string;
  BETTER_AUTH_URL?: string;
  BILLING_DB?: D1Database;
  BILLING_ENFORCEMENT_ENABLED?: string;
  BILLING_PURCHASES_ENABLED?: string;
  CUSTOMER_LEDGER?: DurableObjectNamespace;
  EMAIL_FROM?: string;
  GOOGLE_PLAY_INTEGRITY_ACCESS_TOKEN?: string;
  GOOGLE_PLAY_INTEGRITY_REQUIRED_DEVICE_VERDICT?: string;
  GOOGLE_PLAY_PACKAGE_NAME?: string;
  GOOGLE_SERVICE_ACCOUNT_EMAIL?: string;
  GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?: string;
  MURMUR_ENV?: string;
  MURMUR_REQUIRE_DEVICE_INTEGRITY?: string;
  OPENAI_API_KEY?: string;
  OPENAI_REALTIME_MODEL?: string;
  POSTHOG_PROJECT_TOKEN?: string;
  RATE_LIMITER?: DurableObjectNamespace;
  RESEND_API_KEY?: string;
  REPORT_WEBHOOK_URL?: string;
  REPORT_ADMIN_TOKEN?: string;
  SESSION_HASH_SALT?: string;
  SENTRY_DSN?: string;
  SENTRY_RELEASE?: string;
  REVENUECAT_API_KEY?: string;
  REVENUECAT_PROJECT_ID?: string;
  REVENUECAT_WEBHOOK_AUTH?: string;
  REVENUECAT_WEBHOOK_SIGNING_SECRET?: string;
};

export type WorkerReadiness = {
  env: string;
  missing: {
    optional: string[];
    required: string[];
  };
  ok: boolean;
  providers: {
    billing: "configured" | "disabled" | "missing_required";
    error_monitoring: "configured" | "missing_required";
    product_analytics: "configured" | "missing_required";
    realtime_translation: "configured" | "missing_required";
    report_webhook: "configured" | "missing_optional";
  };
};

const billingRequirements: ReadonlyArray<{ key: keyof Env; name: string }> = [
  { key: "BETTER_AUTH_SECRET", name: "BETTER_AUTH_SECRET" },
  { key: "BILLING_DB", name: "BILLING_DB" },
  { key: "CUSTOMER_LEDGER", name: "CUSTOMER_LEDGER" },
  { key: "EMAIL_FROM", name: "EMAIL_FROM" },
  { key: "RESEND_API_KEY", name: "RESEND_API_KEY" },
  { key: "REVENUECAT_API_KEY", name: "REVENUECAT_API_KEY" },
  { key: "REVENUECAT_PROJECT_ID", name: "REVENUECAT_PROJECT_ID" },
  { key: "REVENUECAT_WEBHOOK_AUTH", name: "REVENUECAT_WEBHOOK_AUTH" },
  { key: "REVENUECAT_WEBHOOK_SIGNING_SECRET", name: "REVENUECAT_WEBHOOK_SIGNING_SECRET" },
];

const productionRequirements: ReadonlyArray<{ key: keyof Env; name: string }> = [
  { key: "SESSION_HASH_SALT", name: "SESSION_HASH_SALT" },
  { key: "POSTHOG_PROJECT_TOKEN", name: "POSTHOG_PROJECT_TOKEN" },
  { key: "SENTRY_DSN", name: "SENTRY_DSN" },
];

export function getReadiness(env: Env): WorkerReadiness {
  const realtimeApiKey = getRealtimeApiKey(env);
  const billingEnabled = isBillingEnforced(env);
  const missingBilling = billingEnabled ? missingRequirements(env, billingRequirements) : [];
  const missingProduction = env.MURMUR_ENV === "production"
    ? missingRequirements(env, productionRequirements)
    : [];
  const missingRealtime = realtimeApiKey ? [] : ["OPENAI_API_KEY"];
  const required = [
    ...missingRealtime,
    ...missingProduction,
    ...missingBilling,
  ];
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
      billing: !billingEnabled
        ? "disabled"
        : missingBilling.length > 0
          ? "missing_required"
          : "configured",
      error_monitoring: env.SENTRY_DSN ? "configured" : "missing_required",
      product_analytics: env.POSTHOG_PROJECT_TOKEN ? "configured" : "missing_required",
      realtime_translation: realtimeApiKey ? "configured" : "missing_required",
      report_webhook: env.REPORT_WEBHOOK_URL || env.REPORT_ADMIN_TOKEN ? "configured" : "missing_optional",
    },
  };
}

function missingRequirements(
  env: Env,
  requirements: ReadonlyArray<{ key: keyof Env; name: string }>,
): string[] {
  return requirements.filter((requirement) => !env[requirement.key])
    .map((requirement) => requirement.name);
}

export function isBillingEnforced(env: Env): boolean {
  return env.BILLING_ENFORCEMENT_ENABLED === "true" ||
    env.BILLING_PURCHASES_ENABLED === "true";
}

export function getRealtimeApiKey(env: Env): string | null {
  return env.OPENAI_API_KEY?.trim() || null;
}

export function requiresDeviceIntegrity(env: Env): boolean {
  return env.MURMUR_REQUIRE_DEVICE_INTEGRITY === "true";
}
