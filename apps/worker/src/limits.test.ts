import { describe, expect, it } from "vitest";

import {
  canCreateSession,
  closeSession,
  createSessionRecord,
  defaultRateLimits,
  getSession,
} from "./limits";

describe("worker session limits", () => {
  it("blocks a second active session for the same install", () => {
    const now = Date.now();
    const installId = `install_active_${now}`;
    createSessionRecord({
      app_session_id: `session_active_${now}`,
      hashed_install_id: installId,
      now_ms: now,
    });

    expect(canCreateSession({
      config: defaultRateLimits,
      hashed_install_id: installId,
      now_ms: now + 1,
    })).toEqual({ code: "active_session_limit", ok: false });
  });

  it("allows a new session after the previous session closes", () => {
    const now = Date.now();
    const installId = `install_closed_${now}`;
    const sessionId = `session_closed_${now}`;
    createSessionRecord({
      app_session_id: sessionId,
      hashed_install_id: installId,
      now_ms: now,
    });
    closeSession(sessionId, now + 1);

    expect(canCreateSession({
      config: defaultRateLimits,
      hashed_install_id: installId,
      now_ms: now + 2,
    })).toEqual({ ok: true });
    expect(getSession(sessionId)?.closed_at_ms).toBe(now + 1);
  });

  it("expires abandoned sessions at the configured limit", () => {
    const now = Date.now();
    const installId = `install_expired_${now}`;
    const sessionId = `session_expired_${now}`;
    createSessionRecord({
      app_session_id: sessionId,
      hashed_install_id: installId,
      now_ms: now,
    });

    expect(canCreateSession({
      config: defaultRateLimits,
      hashed_install_id: installId,
      now_ms: now + defaultRateLimits.maxSessionSeconds * 1_000 + 1,
    })).toEqual({ ok: true });
    expect(getSession(sessionId)?.closed_at_ms).not.toBeNull();
  });
});
