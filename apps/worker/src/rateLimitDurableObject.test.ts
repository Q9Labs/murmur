import { describe, expect, it, vi } from "vitest";

import {
  createSessionIfAllowedDurable,
  isRateLimiterUnavailable,
  RateLimitDurableObject,
  type RateLimiterNamespace,
} from "./rateLimitDurableObject";

function createState() {
  let saved: unknown;
  let alarmAt: number | null = null;
  return {
    blockConcurrencyWhile: vi.fn(async (callback: () => Promise<Response>) => callback()),
    get alarmAt() { return alarmAt; },
    storage: {
      get: vi.fn(async () => saved),
      put: vi.fn(async (_key: string, value: unknown) => {
        saved = structuredClone(value);
      }),
      setAlarm: vi.fn(async (timestamp: number) => { alarmAt = timestamp; }),
      deleteAlarm: vi.fn(async () => { alarmAt = null; }),
    },
  };
}

async function call(
  durableObject: RateLimitDurableObject,
  body: unknown,
): Promise<{ response: Response; value: unknown }> {
  const response = await durableObject.fetch(new Request("https://limiter.test", {
    body: JSON.stringify(body),
    method: "POST",
  }));
  return { response, value: await response.json() };
}

describe("RateLimitDurableObject", () => {
  it("distinguishes dependency failures from ordinary rate limits", () => {
    expect(isRateLimiterUnavailable({ code: "rate_limiter_unavailable", ok: false })).toBe(true);
    expect(isRateLimiterUnavailable({ code: "rate_limiter_invalid_response", ok: false })).toBe(true);
    expect(isRateLimiterUnavailable({ code: "hourly_limit", ok: false })).toBe(false);
    expect(isRateLimiterUnavailable({ ok: true })).toBe(false);
  });

  it("returns service-unavailable semantics when the Durable Object cannot be reached", async () => {
    const durableObjectId: DurableObjectId = {
      equals: () => true,
      toString: () => "rate-limiter-id",
    };
    const namespace: RateLimiterNamespace = {
      get: () => ({
        fetch: async () => {
          throw new Error("durable object unavailable");
        },
      }),
      idFromName: () => durableObjectId,
    };

    await expect(createSessionIfAllowedDurable({
      app_session_id: "session",
      hashed_install_id: "install",
      namespace,
      now_ms: 1,
    })).resolves.toEqual({ code: "rate_limiter_unavailable", ok: false });
  });

  it("returns service-unavailable semantics when the Durable Object rejects the request", async () => {
    const durableObjectId: DurableObjectId = {
      equals: () => true,
      toString: () => "rate-limiter-id",
    };
    const namespace: RateLimiterNamespace = {
      get: () => ({ fetch: async () => new Response(null, { status: 503 }) }),
      idFromName: () => durableObjectId,
    };

    await expect(createSessionIfAllowedDurable({
      app_session_id: "session",
      hashed_install_id: "install",
      namespace,
      now_ms: 1,
    })).resolves.toEqual({ code: "rate_limiter_unavailable", ok: false });
  });

  it("rejects malformed JSON", async () => {
    const durableObject = new RateLimitDurableObject(createState() as unknown as DurableObjectState);
    const response = await durableObject.fetch(new Request("https://limiter.test", {
      body: "{",
      method: "POST",
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "invalid_json" });
  });

  it("prunes telemetry identifiers on an alarm after their one-hour window", async () => {
    const nowMs = 2_000_000_000_000;
    const state = createState();
    const durableObject = new RateLimitDurableObject(state as unknown as DurableObjectState);
    vi.spyOn(Date, "now").mockReturnValue(nowMs);

    await call(durableObject, {
      action: "can_accept_telemetry",
      hashed_client_id: "hashed-address",
      now_ms: nowMs,
    });

    expect(state.alarmAt).toBe(nowMs + 60 * 60 * 1000 + 1);
    vi.spyOn(Date, "now").mockReturnValue(nowMs + 60 * 60 * 1000 + 1);
    await durableObject.alarm();

    expect(await state.storage.get()).toMatchObject({ telemetry_timestamps_by_client: {} });
    expect(state.alarmAt).toBeNull();
    expect(state.storage.deleteAlarm).toHaveBeenCalledOnce();
    vi.restoreAllMocks();
  });

  it("dispatches every persisted limiter action", async () => {
    vi.spyOn(Date, "now").mockReturnValue(2_000_000_000_000);
    const durableObject = new RateLimitDurableObject(createState() as unknown as DurableObjectState);

    expect((await call(durableObject, {
      action: "create_session_record",
      app_session_id: "session",
      enforce_limits: true,
      hashed_install_id: "install",
      now_ms: 2_000_000_000_000,
    })).value).toEqual({ ok: true });
    expect((await call(durableObject, {
      action: "create_session_record",
      app_session_id: "blocked-session",
      enforce_limits: true,
      hashed_install_id: "install",
      now_ms: 2_000_000_000_001,
    })).value).toEqual({ code: "active_session_limit", ok: false });
    expect((await call(durableObject, {
      action: "get_session",
      app_session_id: "session",
    })).value).toMatchObject({ app_session_id: "session" });
    expect((await call(durableObject, {
      action: "reserve_realtime_session",
      app_session_id: "session",
      now_ms: 2_000_000_000_001,
    })).value).toMatchObject({ hashed_install_id: "install", ok: true });
    expect((await call(durableObject, {
      action: "reserve_realtime_session",
      app_session_id: "session",
      now_ms: 2_000_000_000_002,
    })).value).toEqual({ code: "session_already_connected", ok: false });
    expect((await call(durableObject, {
      action: "can_accept_report",
      app_session_id: "session",
      now_ms: 2_000_000_000_000,
    })).value).toEqual({ ok: true });

    const report = {
      app_session_id: "session",
      created_at_ms: 2_000_000_000_000,
      error_category: "other",
      provider_metadata: {},
      report_id: "report",
      retained_text_snapshot: false,
      revision: 1,
      source_language: "en",
      span_id: "span",
      target_language: "ar",
    };
    expect((await call(durableObject, { action: "store_report", report })).value)
      .toEqual({ ok: true });
    expect((await call(durableObject, { action: "list_reports", limit: 50 })).value)
      .toEqual([report]);
    expect((await call(durableObject, {
      action: "delete_report",
      report_id: "report",
    })).value).toEqual({ deleted: true });

    expect((await call(durableObject, {
      action: "store_app_attest_device",
      hashed_install_id: "install",
      key_id: "key",
      now_ms: 2_000_000_000_000,
      public_key_pem: "pem",
      sign_count: 0,
    })).value).toEqual({ ok: true });
    expect((await call(durableObject, {
      action: "get_app_attest_device",
      key_id: "key",
    })).value).toMatchObject({ key_id: "key" });
    expect((await call(durableObject, {
      action: "update_app_attest_sign_count",
      key_id: "key",
      now_ms: 2_000_000_000_001,
      sign_count: 1,
    })).value).toEqual({ ok: true });
    expect((await call(durableObject, {
      action: "close_session",
      app_session_id: "session",
      now_ms: 2_000_000_000_003,
    })).value).toEqual({ ok: true });

    vi.restoreAllMocks();
  });
});
