import { describe, expect, it } from "vitest";

import { getReadiness } from "./env";

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
        error_monitoring: "configured",
        product_analytics: "configured",
        realtime_translation: "configured",
        report_webhook: "configured",
      },
    });
  });
});
