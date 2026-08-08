import { describe, expect, it, vi } from "vitest";

import {
  canAcceptReportWithStores,
  createEmptyDurableLimitState,
  createMemoryAdapter,
  pruneReportInboxWithStores,
  pruneState,
} from "./stateAdapter";

const nowMs = 2_000_000_000_000;

describe("durable rate-limit state adapter", () => {
  it("persists sessions, reports, and App Attest devices", () => {
    vi.spyOn(Date, "now").mockReturnValue(nowMs);
    const state = createEmptyDurableLimitState();
    const adapter = createMemoryAdapter(state);

    expect(adapter.canCreateSession({
      config: {
        activeSessionsPerInstall: 2,
        maxSessionSeconds: 300,
        sessionsPerDay: 20,
        sessionsPerHour: 5,
      },
      hashed_install_id: "install_hash",
      now_ms: nowMs,
    })).toEqual({ ok: true });

    const session = adapter.createSessionRecord({
      app_session_id: "session_1",
      hashed_install_id: "install_hash",
      now_ms: nowMs,
    });
    expect(adapter.getSession("session_1")).toEqual(session);
    expect(adapter.canAcceptReport("session_1", nowMs)).toEqual({ ok: true });

    const report = {
      app_session_id: "session_1",
      created_at_ms: nowMs,
      error_category: "inaccurate",
      provider_metadata: { provider: "openai" },
      report_id: "report_1",
      retained_text_snapshot: false,
      revision: 1,
      source_language: "en",
      span_id: "span_1",
      target_language: "ar",
    };
    adapter.storeReport(report);
    expect(adapter.listReports(50)).toEqual([report]);
    expect(adapter.deleteReport("report_1")).toEqual({ deleted: true });
    expect(adapter.deleteReport("missing")).toEqual({ deleted: false });

    adapter.storeAppAttestDevice({
      hashed_install_id: "install_hash",
      key_id: "key_1",
      now_ms: nowMs,
      public_key_pem: "public key",
      sign_count: 0,
    });
    expect(adapter.getAppAttestDevice("key_1")).toMatchObject({ sign_count: 0 });
    expect(adapter.updateAppAttestSignCount("key_1", 0, nowMs + 1)).toEqual({ ok: false });
    expect(adapter.updateAppAttestSignCount("key_1", 1, nowMs + 2)).toEqual({ ok: true });
    expect(adapter.updateAppAttestSignCount("missing", 1, nowMs + 2)).toEqual({ ok: false });

    adapter.closeSession("session_1", nowMs + 3);
    expect(adapter.getSession("session_1")?.closed_at_ms).toBe(nowMs + 3);
    vi.restoreAllMocks();
  });

  it("enforces report session, expiry, and hourly limits", () => {
    const sessions = new Map([
      ["active", {
        app_session_id: "active",
        closed_at_ms: null,
        created_at_ms: nowMs,
        hashed_install_id: "install",
        realtime_connected_at_ms: null,
      }],
      ["expired", {
        app_session_id: "expired",
        closed_at_ms: null,
        created_at_ms: nowMs - 1_000_000,
        hashed_install_id: "install",
        realtime_connected_at_ms: null,
      }],
    ]);
    const reports = new Map<string, number[]>();

    expect(canAcceptReportWithStores("missing", nowMs, reports, sessions))
      .toEqual({ ok: false, code: "session_closed" });
    expect(canAcceptReportWithStores("expired", nowMs, reports, sessions))
      .toEqual({ ok: false, code: "session_expired" });
    reports.set("active", Array.from({ length: 10 }, () => nowMs));
    expect(canAcceptReportWithStores("active", nowMs, reports, sessions))
      .toEqual({ ok: false, code: "report_rate_limited" });
  });

  it("prunes stale sessions, starts, reports, and inbox records", () => {
    const state = createEmptyDurableLimitState();
    state.sessions_by_id = {
      closed: {
        app_session_id: "closed",
        closed_at_ms: nowMs - 90_000_000,
        created_at_ms: nowMs - 100_000_000,
        hashed_install_id: "install",
        realtime_connected_at_ms: null,
      },
      expired: {
        app_session_id: "expired",
        closed_at_ms: null,
        created_at_ms: nowMs - 2_000_000,
        hashed_install_id: "install",
        realtime_connected_at_ms: null,
      },
    };
    state.session_starts_by_install = {
      empty: [nowMs - 90_000_000],
      retained: [nowMs],
    };
    state.report_timestamps_by_session = {
      empty: [nowMs - 4_000_000],
      retained: [nowMs],
    };
    state.report_inbox_by_id = {
      stale: {
        app_session_id: "closed",
        created_at_ms: nowMs - 40 * 24 * 60 * 60 * 1000,
        error_category: "other",
        provider_metadata: {},
        report_id: "stale",
        retained_text_snapshot: false,
        revision: 1,
        source_language: "en",
        span_id: "span",
        target_language: "ar",
      },
    };
    state.report_inbox_order = ["stale", "missing"];

    pruneState(state, nowMs);

    expect(state.sessions_by_id).toEqual({});
    expect(state.session_starts_by_install).toEqual({ retained: [nowMs] });
    expect(state.report_timestamps_by_session).toEqual({ retained: [nowMs] });
    expect(state.report_inbox_by_id).toEqual({});
    expect(state.report_inbox_order).toEqual([]);
  });

  it("bounds and de-duplicates report inbox order", () => {
    const inbox = new Map([
      ["kept", {
        app_session_id: "session",
        created_at_ms: nowMs,
        error_category: "other",
        provider_metadata: {},
        report_id: "kept",
        retained_text_snapshot: false,
        revision: 1,
        source_language: "en",
        span_id: "span",
        target_language: "ar",
      }],
      ["orphan", {
        app_session_id: "session",
        created_at_ms: nowMs,
        error_category: "other",
        provider_metadata: {},
        report_id: "orphan",
        retained_text_snapshot: false,
        revision: 1,
        source_language: "en",
        span_id: "span",
        target_language: "ar",
      }],
    ]);
    const order = ["kept", "missing"];

    pruneReportInboxWithStores(nowMs, inbox, order);

    expect(order).toEqual(["kept"]);
    expect([...inbox.keys()]).toEqual(["kept"]);
  });
});
