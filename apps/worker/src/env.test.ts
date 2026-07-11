import { describe, expect, it } from "vitest";

import { getReadiness } from "./env";

describe("worker env readiness", () => {
  it("reports non-secret readiness gaps for missing provider configuration", () => {
    expect(getReadiness({ MURMUR_ENV: "production" })).toEqual({
      env: "production",
      missing: {
        optional: [
          "CARTESIA_API_KEY",
          "CARTESIA_DEFAULT_VOICE_ID_OR_CARTESIA_VOICE_ID_BY_LANGUAGE",
          "REPORT_WEBHOOK_URL_OR_REPORT_ADMIN_TOKEN",
        ],
        required: ["DEEPGRAM_API_KEY", "OPENROUTER_API_KEY", "SESSION_HASH_SALT"],
      },
      ok: false,
      providers: {
        cartesia_speech: "missing_optional",
        deepgram_stt: "missing_required",
        openrouter_translation: "missing_required",
        report_webhook: "missing_optional",
      },
    });
  });

  it("reports ready when required providers are configured", () => {
    expect(
      getReadiness({
        CARTESIA_API_KEY: "cartesia_key",
        CARTESIA_DEFAULT_VOICE_ID: "voice_id",
        DEEPGRAM_API_KEY: "deepgram_key",
        MURMUR_ENV: "production",
        OPENROUTER_API_KEY: "openrouter_key",
        REPORT_WEBHOOK_URL: "https://example.test/webhook",
        SESSION_HASH_SALT: "salt",
      }),
    ).toEqual({
      env: "production",
      missing: {
        optional: [],
        required: [],
      },
      ok: true,
      providers: {
        cartesia_speech: "configured",
        deepgram_stt: "configured",
        openrouter_translation: "configured",
        report_webhook: "configured",
      },
    });
  });

  it("disables Cartesia readiness requirements only when speech is explicitly disabled", () => {
    expect(
      getReadiness({
        DEEPGRAM_API_KEY: "deepgram_key",
        MURMUR_ENABLE_SPEECH: "false",
        MURMUR_ENV: "production",
        OPENROUTER_API_KEY: "openrouter_key",
        REPORT_ADMIN_TOKEN: "report_admin_token",
        SESSION_HASH_SALT: "salt",
      }),
    ).toMatchObject({
      missing: {
        optional: [],
        required: [],
      },
      ok: true,
      providers: {
        cartesia_speech: "disabled",
      },
    });
  });

  it("treats the report admin inbox token as report triage readiness", () => {
    expect(
      getReadiness({
        DEEPGRAM_API_KEY: "deepgram_key",
        MURMUR_ENV: "production",
        OPENROUTER_API_KEY: "openrouter_key",
        REPORT_ADMIN_TOKEN: "admin_token",
        SESSION_HASH_SALT: "salt",
      }),
    ).toMatchObject({
      missing: {
        required: [],
      },
      providers: {
        report_webhook: "configured",
      },
    });
  });
});
