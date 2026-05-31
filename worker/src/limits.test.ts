import { describe, expect, it } from "vitest";

import {
  beginTranslation,
  canCreateSession,
  closeSession,
  createSessionRecord,
  defaultRateLimits,
  endTranslation,
} from "./limits";

describe("worker limits", () => {
  it("blocks a second active session for the same install", () => {
    const now = Date.now();
    const install = `install_${now}`;
    const first = canCreateSession({
      config: defaultRateLimits,
      hashed_install_id: install,
      now_ms: now,
    });
    expect(first.ok).toBe(true);
    createSessionRecord({
      app_session_id: `session_${now}`,
      hashed_install_id: install,
      now_ms: now,
    });

    const second = canCreateSession({
      config: defaultRateLimits,
      hashed_install_id: install,
      now_ms: now + 1,
    });
    expect(second).toEqual({ ok: false, code: "active_session_limit" });
  });

  it("allows a new session after the previous active session is closed", () => {
    const now = Date.now();
    const install = `install_reopen_${now}`;
    const appSessionId = `session_reopen_${now}`;
    expect(
      canCreateSession({
        config: defaultRateLimits,
        hashed_install_id: install,
        now_ms: now,
      }).ok,
    ).toBe(true);
    createSessionRecord({
      app_session_id: appSessionId,
      hashed_install_id: install,
      now_ms: now,
    });

    closeSession(appSessionId, now + 1);

    expect(
      canCreateSession({
        config: defaultRateLimits,
        hashed_install_id: install,
        now_ms: now + 2,
      }).ok,
    ).toBe(true);
  });

  it("enforces span length and concurrent translation limits", () => {
    const now = Date.now();
    const appSessionId = `session_limit_${now}`;
    createSessionRecord({
      app_session_id: appSessionId,
      hashed_install_id: `install_limit_${now}`,
      now_ms: now,
    });

    expect(
      beginTranslation({
        app_session_id: appSessionId,
        config: defaultRateLimits,
        now_ms: now,
        source_caption: "a".repeat(defaultRateLimits.maxCharsPerSpan + 1),
      }),
    ).toEqual({ ok: false, code: "span_too_long" });

    expect(
      beginTranslation({
        app_session_id: appSessionId,
        config: defaultRateLimits,
        now_ms: now,
        source_caption: "hello",
      }).ok,
    ).toBe(true);
    expect(
      beginTranslation({
        app_session_id: appSessionId,
        config: defaultRateLimits,
        now_ms: now,
        source_caption: "again",
      }).ok,
    ).toBe(true);
    expect(
      beginTranslation({
        app_session_id: appSessionId,
        config: defaultRateLimits,
        now_ms: now,
        source_caption: "third",
      }),
    ).toEqual({ ok: false, code: "concurrent_translation_limit" });

    endTranslation(appSessionId);
    closeSession(appSessionId, now + 1);
  });

  it("allows up to 60 translated spans per minute", () => {
    const now = Date.now();
    const config = {
      ...defaultRateLimits,
      concurrentTranslationsPerSession: defaultRateLimits.translatedSpansPerMinute,
    };
    const appSessionId = `session_span_rate_${now}`;
    createSessionRecord({
      app_session_id: appSessionId,
      hashed_install_id: `install_span_rate_${now}`,
      now_ms: now,
    });

    for (let index = 0; index < defaultRateLimits.translatedSpansPerMinute; index += 1) {
      expect(
        beginTranslation({
          app_session_id: appSessionId,
          config,
          now_ms: now + index,
          source_caption: `span ${index}`,
        }).ok,
      ).toBe(true);
    }

    expect(
      beginTranslation({
        app_session_id: appSessionId,
        config,
        now_ms: now + defaultRateLimits.translatedSpansPerMinute,
        source_caption: "one more",
      }),
    ).toEqual({ ok: false, code: "translated_spans_per_minute_limit" });

    closeSession(appSessionId, now + 1);
  });
});
