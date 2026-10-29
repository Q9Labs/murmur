/// <reference types="@cloudflare/workers-types" />

export type Env = {
  MURMUR_DIAGNOSTICS_FIXTURE?: string;
  APPLE_CLIENT_ID?: string;
  APPLE_TEAM_ID?: string;
  APPLE_KEY_ID?: string;
  APPLE_PRIVATE_KEY?: string;
  APPLE_APP_BUNDLE_IDENTIFIER?: string;
  APPLE_APP_ATTEST_APP_ID?: string;
  APPLE_APP_ATTEST_ENVIRONMENT?: string;
  BETTER_AUTH_SECRET?: string;
  BETTER_AUTH_URL?: string;
  BILLING_DB?: D1Database;
  BILLING_ENFORCEMENT_ENABLED?: string;
  BILLING_FULFILLMENT_ENABLED?: string;
  BILLING_PURCHASES_ENABLED?: string;
  CUSTOMER_LEDGER?: DurableObjectNamespace;
  EMAIL_FROM?: string;
  GOOGLE_PLAY_INTEGRITY_ACCESS_TOKEN?: string;
  GOOGLE_WEB_CLIENT_ID?: string;
  GOOGLE_IOS_CLIENT_ID?: string;
  GOOGLE_ANDROID_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GOOGLE_PLAY_INTEGRITY_REQUIRED_DEVICE_VERDICT?: string;
  GOOGLE_PLAY_PACKAGE_NAME?: string;
  GOOGLE_SERVICE_ACCOUNT_EMAIL?: string;
  GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?: string;
  MURMUR_ENV?: string;
  MURMUR_REQUIRE_DEVICE_INTEGRITY?: string;
  OPENAI_API_KEY?: string;
  OPENAI_REALTIME_MODEL?: string;
  OPENROUTER_API_KEY?: string;
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
  REVENUECAT_CUSTOMER_NAMESPACE?: string;
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
    apple_sign_in: "configured" | "missing_optional";
    billing: "configured" | "disabled" | "missing_required";
    error_monitoring: "configured" | "missing_required";
    google_sign_in: "configured" | "missing_optional";
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

// Google sign-in verifies native idTokens for every listed audience; the web
// client id + secret enable the provider, the platform client ids cover the
// audiences native clients actually send.
const googleSignInRequirements: ReadonlyArray<{ key: keyof Env; name: string }> = [
  { key: "GOOGLE_WEB_CLIENT_ID", name: "GOOGLE_WEB_CLIENT_ID" },
  { key: "GOOGLE_CLIENT_SECRET", name: "GOOGLE_CLIENT_SECRET" },
  { key: "GOOGLE_IOS_CLIENT_ID", name: "GOOGLE_IOS_CLIENT_ID" },
  { key: "GOOGLE_ANDROID_CLIENT_ID", name: "GOOGLE_ANDROID_CLIENT_ID" },
];

const appleSignInRequirements: ReadonlyArray<{ key: keyof Env; name: string }> = [
  { key: "APPLE_CLIENT_ID", name: "APPLE_CLIENT_ID" },
  { key: "APPLE_TEAM_ID", name: "APPLE_TEAM_ID" },
  { key: "APPLE_KEY_ID", name: "APPLE_KEY_ID" },
  { key: "APPLE_PRIVATE_KEY", name: "APPLE_PRIVATE_KEY" },
  { key: "APPLE_APP_BUNDLE_IDENTIFIER", name: "APPLE_APP_BUNDLE_IDENTIFIER" },
];

const productionRequirements: ReadonlyArray<{ key: keyof Env; name: string }> = [
  { key: "SESSION_HASH_SALT", name: "SESSION_HASH_SALT" },
  { key: "POSTHOG_PROJECT_TOKEN", name: "POSTHOG_PROJECT_TOKEN" },
  { key: "SENTRY_DSN", name: "SENTRY_DSN" },
];

// Social sign-in providers stay optional (email sign-in keeps working), but a
// partially configured provider is an actionable misconfiguration: report the
// exact missing variables so it can be finished or removed deliberately.
function socialProviderReadiness(env: Env): {
  missing: string[];
  providers: {
    apple_sign_in: "configured" | "missing_optional";
    google_sign_in: "configured" | "missing_optional";
  };
} {
  const appleMissing = missingRequirements(env, appleSignInRequirements);
  const googleMissing = missingRequirements(env, googleSignInRequirements);
  return {
    missing: [
      ...(appleMissing.length > 0 && appleMissing.length < appleSignInRequirements.length
        ? appleMissing
        : []),
      ...(googleMissing.length > 0 && googleMissing.length < googleSignInRequirements.length
        ? googleMissing
        : []),
    ],
    providers: {
      apple_sign_in: appleMissing.length === 0 ? "configured" : "missing_optional",
      google_sign_in: googleMissing.length === 0 ? "configured" : "missing_optional",
    },
  };
}

export function getReadiness(env: Env): WorkerReadiness {
  const realtimeApiKey = getRealtimeApiKey(env);
  const billingEnabled = isBillingEnforced(env) ||
    isBillingFulfillmentEnabled(env) ||
    areBillingPurchasesEnabled(env);
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
  const social = socialProviderReadiness(env);
  const optional = [
    !env.REPORT_WEBHOOK_URL && !env.REPORT_ADMIN_TOKEN ? "REPORT_WEBHOOK_URL_OR_REPORT_ADMIN_TOKEN" : null,
    ...social.missing,
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
      ...social.providers,
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
  return env.BILLING_ENFORCEMENT_ENABLED === "true";
}

export function isBillingFulfillmentEnabled(env: Env): boolean {
  return env.BILLING_FULFILLMENT_ENABLED === "true";
}

export function areBillingPurchasesEnabled(env: Env): boolean {
  return env.BILLING_PURCHASES_ENABLED === "true";
}

export function getRealtimeApiKey(env: Env): string | null {
  return env.OPENAI_API_KEY?.trim() || null;
}

export function requiresDeviceIntegrity(env: Env): boolean {
  return env.MURMUR_REQUIRE_DEVICE_INTEGRITY === "true";
}
