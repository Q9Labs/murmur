import { describe, expect, it } from "vitest";

import { getReadiness, isBillingEnforced } from "./env";

describe("worker env readiness", () => {
  it("reports the OpenAI key and production salt as required", () => {
    expect(getReadiness({ MURMUR_ENV: "production" })).toEqual({
      env: "production",
      missing: {
        optional: ["REPORT_WEBHOOK_URL_OR_REPORT_ADMIN_TOKEN"],
        required: ["OPENAI_API_KEY", "SESSION_HASH_SALT", "POSTHOG_PROJECT_TOKEN", "SENTRY_DSN"],
      },
      ok: false,
      providers: {
        billing: "disabled",
        error_monitoring: "missing_required",
        product_analytics: "missing_required",
        realtime_translation: "missing_required",
        report_webhook: "missing_optional",
      },
    });
  });

  it("reports ready when realtime translation is configured", () => {
    expect(
      getReadiness({
        MURMUR_ENV: "production",
        OPENAI_API_KEY: "openai_key",
        POSTHOG_PROJECT_TOKEN: "posthog_token",
        REPORT_ADMIN_TOKEN: "admin_token",
        SENTRY_DSN: "sentry_dsn",
        SESSION_HASH_SALT: "salt",
      }),
    ).toEqual({
      env: "production",
      missing: { optional: [], required: [] },
      ok: true,
      providers: {
        billing: "disabled",
        error_monitoring: "configured",
        product_analytics: "configured",
        realtime_translation: "configured",
        report_webhook: "configured",
      },
    });
  });

  it("fails readiness when billing is enabled without its bindings and secrets", () => {
    const readiness = getReadiness({
      BILLING_PURCHASES_ENABLED: "true",
      MURMUR_ENV: "development",
      OPENAI_API_KEY: "openai_key",
    });

    expect(readiness.providers.billing).toBe("missing_required");
    expect(readiness.missing.required).toEqual([
      "BETTER_AUTH_SECRET",
      "BILLING_DB",
      "CUSTOMER_LEDGER",
      "EMAIL_FROM",
      "RESEND_API_KEY",
      "REVENUECAT_API_KEY",
      "REVENUECAT_PROJECT_ID",
      "REVENUECAT_WEBHOOK_AUTH",
      "REVENUECAT_WEBHOOK_SIGNING_SECRET",
    ]);
  });

  it("keeps metering independent from the new-purchase kill switch", () => {
    expect(isBillingEnforced({
      BILLING_ENFORCEMENT_ENABLED: "true",
      BILLING_PURCHASES_ENABLED: "false",
    })).toBe(true);
    expect(isBillingEnforced({
      BILLING_ENFORCEMENT_ENABLED: "false",
      BILLING_PURCHASES_ENABLED: "true",
    })).toBe(true);
    expect(isBillingEnforced({
      BILLING_ENFORCEMENT_ENABLED: "false",
      BILLING_PURCHASES_ENABLED: "false",
    })).toBe(false);
  });
});
