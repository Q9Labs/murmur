import { describe, expect, it, vi } from "vitest";

import { RateLimitDurableObject } from "./rateLimitDurableObject";

function createState() {
  let saved: unknown;
  return {
    blockConcurrencyWhile: vi.fn(async (callback: () => Promise<Response>) => callback()),
    storage: {
      get: vi.fn(async () => saved),
      put: vi.fn(async (_key: string, value: unknown) => {
        saved = structuredClone(value);
      }),
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
  it("rejects malformed JSON", async () => {
    const durableObject = new RateLimitDurableObject(createState() as unknown as DurableObjectState);
    const response = await durableObject.fetch(new Request("https://limiter.test", {
      body: "{",
      method: "POST",
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "invalid_json" });
  });

  it("dispatches every persisted limiter action", async () => {
    vi.spyOn(Date, "now").mockReturnValue(2_000_000_000_000);
    const durableObject = new RateLimitDurableObject(createState() as unknown as DurableObjectState);

    expect((await call(durableObject, {
      action: "can_create_session",
      hashed_install_id: "install",
      now_ms: 2_000_000_000_000,
    })).value).toEqual({ ok: true });
    expect((await call(durableObject, {
      action: "create_session_record",
      app_session_id: "session",
      hashed_install_id: "install",
      now_ms: 2_000_000_000_000,
    })).value).toMatchObject({ app_session_id: "session" });
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
