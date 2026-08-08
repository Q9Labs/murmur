import { describe, expect, it } from "vitest";

import { getReadiness } from "./env";

describe("worker env readiness", () => {
  it("reports the OpenAI key and production salt as required", () => {
    expect(getReadiness({ MURMUR_ENV: "production" })).toEqual({
      env: "production",
      missing: {
        optional: ["REPORT_WEBHOOK_URL_OR_REPORT_ADMIN_TOKEN"],
        required: ["OPENAI_API_KEY", "SESSION_HASH_SALT"],
      },
      ok: false,
      providers: {
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
        REPORT_ADMIN_TOKEN: "admin_token",
        SESSION_HASH_SALT: "salt",
      }),
    ).toEqual({
      env: "production",
      missing: { optional: [], required: [] },
      ok: true,
      providers: {
        realtime_translation: "configured",
        report_webhook: "configured",
      },
    });
  });
});
