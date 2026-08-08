import { describe, expect, it } from "vitest";

import { defaultRateLimits } from "../limits";
import { callMemoryLimiter } from "./memoryFallback";
import {
  canAcceptReportWithStores,
  createEmptyDurableLimitState,
  createMemoryAdapter,
  pruneState,
} from "./stateAdapter";
import {
  canCreateSessionWithStores,
  closeSessionWithStores,
  createSessionRecordWithStores,
  reserveRealtimeSessionWithStores,
  type SessionStore,
} from "./sessionStore";

function createStore(): SessionStore {
  return {
    sessionStartsByInstall: new Map(),
    sessionsById: new Map(),
  };
}

describe("rate limiter session stores", () => {
  it("creates, limits, and closes sessions through the shared store", () => {
    const store = createStore();
    createSessionRecordWithStores({
      app_session_id: "session_1",
      hashed_install_id: "install_1",
      now_ms: 1,
    }, store);

    expect(canCreateSessionWithStores({
      config: defaultRateLimits,
      hashed_install_id: "install_1",
      now_ms: 2,
    }, store)).toEqual({ code: "active_session_limit", ok: false });

    closeSessionWithStores("session_1", 3, store.sessionsById);
    expect(store.sessionsById.get("session_1")?.closed_at_ms).toBe(3);
  });

  it("keeps the durable adapter synchronized with serializable state", () => {
    const state = createEmptyDurableLimitState();
    const adapter = createMemoryAdapter(state);
    adapter.createSessionRecord({
      app_session_id: "session_1",
      hashed_install_id: "install_1",
      now_ms: 1,
    });
    adapter.storeAppAttestDevice({
      hashed_install_id: "install_1",
      key_id: "key_1",
      now_ms: 1,
      public_key_pem: "public",
      sign_count: 0,
    });

    expect(state.sessions_by_id.session_1?.hashed_install_id).toBe("install_1");
    expect(adapter.getSession("session_1")?.closed_at_ms).toBeNull();
    expect(adapter.getAppAttestDevice("key_1")?.public_key_pem).toBe("public");
  });

  it("reserves each realtime session once and rejects expired sessions", () => {
    const store = createStore();
    createSessionRecordWithStores({
      app_session_id: "session_once",
      hashed_install_id: "install_once",
      now_ms: 1_000,
    }, store);

    expect(reserveRealtimeSessionWithStores({
      app_session_id: "session_once",
      config: defaultRateLimits,
      now_ms: 2_000,
    }, store.sessionsById)).toEqual({
      expires_at_ms: 901_000,
      hashed_install_id: "install_once",
      ok: true,
    });
    expect(reserveRealtimeSessionWithStores({
      app_session_id: "session_once",
      config: defaultRateLimits,
      now_ms: 3_000,
    }, store.sessionsById)).toEqual({
      code: "session_already_connected",
      ok: false,
    });

    createSessionRecordWithStores({
      app_session_id: "session_expired",
      hashed_install_id: "install_expired",
      now_ms: 1_000,
    }, store);
    expect(reserveRealtimeSessionWithStores({
      app_session_id: "session_expired",
      config: defaultRateLimits,
      now_ms: 901_000,
    }, store.sessionsById)).toEqual({ code: "session_expired", ok: false });
    expect(store.sessionsById.get("session_expired")?.closed_at_ms).toBe(901_000);
  });

  it("rate-limits reports and prunes expired state", () => {
    const reports = new Map<string, number[]>();
    for (let index = 0; index < 10; index += 1) {
      expect(canAcceptReportWithStores("session_1", index, reports)).toEqual({ ok: true });
    }
    expect(canAcceptReportWithStores("session_1", 11, reports)).toEqual({
      code: "report_rate_limited",
      ok: false,
    });

    const state = createEmptyDurableLimitState();
    state.session_starts_by_install.install_1 = [0];
    pruneState(state, 25 * 60 * 60 * 1_000);
    expect(state.session_starts_by_install).toEqual({});
  });

  it("uses the same session contract in the in-memory fallback", () => {
    const suffix = Date.now().toString(36);
    const sessionId = `session_memory_${suffix}`;
    expect(callMemoryLimiter({
      action: "create_session_record",
      app_session_id: sessionId,
      hashed_install_id: `install_memory_${suffix}`,
      now_ms: 1,
    })).toMatchObject({ app_session_id: sessionId, closed_at_ms: null });
    expect(callMemoryLimiter({
      action: "get_session",
      app_session_id: sessionId,
    })).toMatchObject({ app_session_id: sessionId });
    expect(callMemoryLimiter({
      action: "reserve_realtime_session",
      app_session_id: sessionId,
      now_ms: 2,
    })).toMatchObject({ hashed_install_id: `install_memory_${suffix}`, ok: true });
    expect(callMemoryLimiter({
      action: "reserve_realtime_session",
      app_session_id: sessionId,
      now_ms: 3,
    })).toEqual({ code: "session_already_connected", ok: false });
  });
});
