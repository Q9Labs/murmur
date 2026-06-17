import { describe, expect, it } from "vitest";

import { defaultRateLimits, type RateLimitConfig } from "../limits";
import { callMemoryLimiter } from "./memoryFallback";
import {
  canAcceptReportWithStores,
  createEmptyDurableLimitState,
  createMemoryAdapter,
  pruneReportInboxWithStores,
  pruneState,
} from "./stateAdapter";
import {
  beginSummaryWithStores,
  beginTranslationWithStores,
  canCreateSessionWithStores,
  canRefreshTokensWithStores,
  closeSessionWithStores,
  createSessionRecordWithStores,
  endSummaryWithStores,
  endTranslationWithStores,
  type SessionStore,
} from "./sessionStore";
import type { ReportInboxRecord } from "./types";

function makeStore(): SessionStore {
  return {
    sessionStartsByInstall: new Map(),
    sessionsById: new Map(),
  };
}

function makeReport(reportId: string, nowMs: number): ReportInboxRecord {
  return {
    app_session_id: "session_1",
    created_at_ms: nowMs,
    error_category: "wrong_language",
    report_id: reportId,
    retained_text_snapshot: false,
    revision: 1,
    source_language: "en",
    span_id: "span_1",
    target_language: "ar",
  };
}

describe("rate limiter session stores", () => {
  it("applies session, translation, summary, and refresh limits through the shared store", () => {
    const store = makeStore();
    const config: RateLimitConfig = {
      ...defaultRateLimits,
      concurrentSummariesPerSession: 1,
      concurrentTranslationsPerSession: 1,
      translatedSpansPerMinute: 2,
    };

    expect(
      createSessionRecordWithStores(
        {
          app_session_id: "session_1",
          hashed_install_id: "install_1",
          now_ms: 1_000,
        },
        store,
      ),
    ).toMatchObject({
      app_session_id: "session_1",
      hashed_install_id: "install_1",
      in_flight_summaries: 0,
      in_flight_translations: 0,
    });

    expect(
      canCreateSessionWithStores(
        {
          config,
          hashed_install_id: "install_1",
          now_ms: 1_100,
        },
        store,
      ),
    ).toEqual({ ok: false, code: "active_session_limit" });

    expect(
      beginTranslationWithStores(
        {
          app_session_id: "session_1",
          config,
          now_ms: 1_200,
          source_caption: "hello",
        },
        store,
      ),
    ).toEqual({ ok: true });
    expect(
      beginTranslationWithStores(
        {
          app_session_id: "session_1",
          config,
          now_ms: 1_300,
          source_caption: "hello again",
        },
        store,
      ),
    ).toEqual({ ok: false, code: "concurrent_translation_limit" });

    endTranslationWithStores("session_1", store.sessionsById);
    expect(store.sessionsById.get("session_1")?.in_flight_translations).toBe(0);

    expect(
      beginSummaryWithStores(
        {
          app_session_id: "session_1",
          config,
          now_ms: 1_400,
        },
        store,
      ),
    ).toEqual({ ok: true });
    expect(
      beginSummaryWithStores(
        {
          app_session_id: "session_1",
          config,
          now_ms: 1_500,
        },
        store,
      ),
    ).toEqual({ ok: false, code: "concurrent_summary_limit" });

    endSummaryWithStores("session_1", store.sessionsById);
    expect(store.sessionsById.get("session_1")?.in_flight_summaries).toBe(0);

    expect(
      canRefreshTokensWithStores(
        {
          app_session_id: "session_1",
          config,
          hashed_install_id: "install_1",
          now_ms: 1_600,
        },
        store,
      ),
    ).toEqual({ ok: true });

    closeSessionWithStores("session_1", 1_700, store.sessionsById);
    expect(
      canRefreshTokensWithStores(
        {
          app_session_id: "session_1",
          config,
          hashed_install_id: "install_1",
          now_ms: 1_800,
        },
        store,
      ),
    ).toEqual({ ok: false, code: "session_closed" });
  });

  it("keeps the durable memory adapter synchronized with its serializable state", () => {
    const state = createEmptyDurableLimitState();
    const adapter = createMemoryAdapter(state);

    adapter.createSessionRecord({
      app_session_id: "session_1",
      hashed_install_id: "install_1",
      now_ms: 2_000,
    });
    expect(state.sessions_by_id.session_1).toMatchObject({
      app_session_id: "session_1",
      hashed_install_id: "install_1",
    });

    expect(
      adapter.beginTranslation({
        app_session_id: "session_1",
        config: defaultRateLimits,
        now_ms: 2_100,
        source_caption: "hello",
      }),
    ).toEqual({ ok: true });
    expect(state.sessions_by_id.session_1?.in_flight_translations).toBe(1);
    adapter.endTranslation("session_1");
    expect(state.sessions_by_id.session_1?.in_flight_translations).toBe(0);

    expect(adapter.canAcceptReport("session_1", 2_200)).toEqual({ ok: true });
    expect(state.report_timestamps_by_session.session_1).toEqual([2_200]);

    const reportNowMs = Date.now();
    adapter.storeReport(makeReport("report_1", reportNowMs));
    adapter.storeReport(makeReport("report_2", reportNowMs + 1));
    expect(adapter.listReports(10).map((report) => report.report_id)).toEqual([
      "report_2",
      "report_1",
    ]);
    expect(state.report_inbox_order).toEqual(["report_2", "report_1"]);
    expect(adapter.deleteReport("report_1")).toEqual({ deleted: true });
    expect(state.report_inbox_order).toEqual(["report_2"]);

    adapter.storeAppAttestDevice({
      hashed_install_id: "install_1",
      key_id: "key_1",
      now_ms: 2_500,
      public_key_pem: "pem",
      sign_count: 1,
    });
    expect(adapter.getAppAttestDevice("key_1")).toMatchObject({
      key_id: "key_1",
      sign_count: 1,
    });
    expect(adapter.updateAppAttestSignCount("key_1", 1, 2_600)).toEqual({ ok: false });
    expect(adapter.updateAppAttestSignCount("key_1", 2, 2_700)).toEqual({ ok: true });
    expect(state.app_attest_devices_by_key_id.key_1?.sign_count).toBe(2);
  });

  it("prunes report and state windows without keeping orphaned inbox entries", () => {
    const inboxById = new Map([
      ["recent", makeReport("recent", 30 * 24 * 60 * 60 * 1000)],
      ["old", makeReport("old", 0)],
      ["missing_from_order", makeReport("missing_from_order", 30 * 24 * 60 * 60 * 1000)],
    ]);
    const inboxOrder = ["recent", "old"];
    pruneReportInboxWithStores(31 * 24 * 60 * 60 * 1000, inboxById, inboxOrder);
    expect(inboxOrder).toEqual(["recent"]);
    expect([...inboxById.keys()]).toEqual(["recent"]);

    const state = createEmptyDurableLimitState();
    state.sessions_by_id.closed_old = {
      app_session_id: "closed_old",
      closed_at_ms: 0,
      created_at_ms: 0,
      hashed_install_id: "install_1",
      in_flight_summaries: 0,
      in_flight_translations: 0,
      summary_timestamps: [],
      translated_span_timestamps: [],
    };
    state.session_starts_by_install.install_1 = [0, 31 * 60 * 60 * 1000];
    state.report_timestamps_by_session.session_1 = [0, 47.5 * 60 * 60 * 1000];

    pruneState(state, 48 * 60 * 60 * 1000);
    expect(state.sessions_by_id.closed_old).toBeUndefined();
    expect(state.session_starts_by_install.install_1).toEqual([31 * 60 * 60 * 1000]);
    expect(state.report_timestamps_by_session.session_1).toEqual([47.5 * 60 * 60 * 1000]);
  });

  it("shares report rate limiting between durable and memory paths", () => {
    const reportsBySession = new Map<string, number[]>();
    const sessionsById = new Map([
      [
        "session_1",
        {
          app_session_id: "session_1",
          closed_at_ms: null,
          created_at_ms: 10_000,
          hashed_install_id: "install_1",
          in_flight_summaries: 0,
          in_flight_translations: 0,
          summary_timestamps: [],
          translated_span_timestamps: [],
        },
      ],
    ]);

    for (let index = 0; index < 10; index += 1) {
      expect(canAcceptReportWithStores("session_1", 10_000 + index, reportsBySession, sessionsById)).toEqual({
        ok: true,
      });
    }
    expect(canAcceptReportWithStores("session_1", 10_999, reportsBySession, sessionsById)).toEqual({
      ok: false,
      code: "report_rate_limited",
    });

    const suffix = "fallback_shared_store";
    const appSessionId = `session_${suffix}`;
    const hashedInstallId = `install_${suffix}`;
    expect(
      callMemoryLimiter({
        action: "create_session_record",
        app_session_id: appSessionId,
        hashed_install_id: hashedInstallId,
        now_ms: 20_000,
      }),
    ).toMatchObject({ app_session_id: appSessionId });
    expect(
      callMemoryLimiter({
        action: "begin_translation",
        app_session_id: appSessionId,
        now_ms: 20_100,
        source_caption: "hello",
      }),
    ).toEqual({ ok: true });
    expect(callMemoryLimiter({ action: "end_translation", app_session_id: appSessionId })).toEqual({
      ok: true,
    });
    expect(callMemoryLimiter({ action: "get_session", app_session_id: appSessionId })).toMatchObject({
      app_session_id: appSessionId,
      in_flight_translations: 0,
    });
  });
});
