import { describe, expect, it, vi } from "vitest";

vi.mock("@bradford-tech/supabase-integrity-attest", () => ({
  AssertionError: class AssertionError extends Error {},
  AttestationError: class AttestationError extends Error {},
  verifyAssertion: vi.fn(),
  verifyAttestation: vi.fn(),
}));

import worker from "./index";

describe("worker routes", () => {
  it("answers preflight requests with CORS headers", async () => {
    const response = await worker.fetch(
      new Request("https://worker.example/v1/session", { method: "OPTIONS" }),
      {},
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it.each(["/", "/privacy", "/terms", "/support"])(
    "serves the public page at %s",
    async (path) => {
      const response = await worker.fetch(
        new Request(`https://worker.example${path}`),
        {},
      );

      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toContain("text/html");
      expect(await response.text()).toContain("Murmur");
    },
  );

  it("serves health without exposing configuration", async () => {
    const response = await worker.fetch(
      new Request("https://worker.example/health"),
      { MURMUR_ENV: "test" },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ env: "test", ok: true });
  });

  it("reports missing realtime configuration", async () => {
    const response = await worker.fetch(
      new Request("https://worker.example/ready"),
      { MURMUR_ENV: "production" },
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      missing: { required: ["OPENAI_API_KEY", "SESSION_HASH_SALT"] },
      ok: false,
      providers: { realtime_translation: "missing_required" },
    });
  });

  it("rejects session creation when the OpenAI provider is not configured", async () => {
    const response = await worker.fetch(
      new Request("https://worker.example/v1/session", {
        body: JSON.stringify({
          app_install_id: "install_12345678",
          source_language: "en",
          target_language: "ar",
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      }),
      {},
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: "provider_unconfigured",
      missing: ["OPENAI_API_KEY"],
    });
  });

  it("validates session requests before provider configuration", async () => {
    const invalidJson = await worker.fetch(
      new Request("https://worker.example/v1/session", {
        body: "{",
        method: "POST",
      }),
      {},
    );
    expect(invalidJson.status).toBe(400);
    await expect(invalidJson.json()).resolves.toEqual({ error: "invalid_json" });

    const invalidInstall = await worker.fetch(
      new Request("https://worker.example/v1/session", {
        body: JSON.stringify({
          app_install_id: "short",
          source_language: "en",
          target_language: "ar",
        }),
        method: "POST",
      }),
      {},
    );
    expect(invalidInstall.status).toBe(400);
    await expect(invalidInstall.json()).resolves.toEqual({ error: "invalid_install_id" });
  });

  it("creates and closes an OpenAI realtime session", async () => {
    const createResponse = await worker.fetch(
      new Request("https://worker.example/v1/session", {
        body: JSON.stringify({
          app_install_id: `install_${crypto.randomUUID()}`,
          source_language: "en",
          target_language: "ar",
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      }),
      {
        OPENAI_API_KEY: "test_key",
        SESSION_HASH_SALT: "test_salt",
      },
    );

    expect(createResponse.status).toBe(200);
    const session = await createResponse.json() as {
      app_session_id: string;
      limits: { max_session_seconds: number };
      realtime_ws_url: string;
      session_epoch: number;
    };
    expect(session.limits.max_session_seconds).toBeGreaterThan(0);
    expect(session.realtime_ws_url).toContain(
      `app_session_id=${encodeURIComponent(session.app_session_id)}`,
    );
    expect(session.realtime_ws_url).toContain("target_language=ar");
    expect(session.realtime_ws_url).toMatch(/^wss:/);
    expect(session.session_epoch).toBe(1);

    const closeResponse = await worker.fetch(
      new Request(
        `https://worker.example/v1/session/${session.app_session_id}/stop`,
        { method: "POST" },
      ),
      {},
    );
    expect(closeResponse.status).toBe(200);
    await expect(closeResponse.json()).resolves.toEqual({ ok: true });
  });

  it("rejects required integrity when the device proof is absent", async () => {
    const response = await worker.fetch(
      new Request("https://worker.example/v1/session", {
        body: JSON.stringify({
          app_install_id: "install_integrity_required",
          source_language: "en",
          target_language: "ar",
        }),
        method: "POST",
      }),
      {
        MURMUR_REQUIRE_DEVICE_INTEGRITY: "true",
        OPENAI_API_KEY: "test_key",
      },
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "device_integrity_required",
    });
  });

  it("stores, lists, and deletes report receipts", async () => {
    const createResponse = await worker.fetch(
      new Request("https://worker.example/v1/session", {
        body: JSON.stringify({
          app_install_id: `install_report_${crypto.randomUUID()}`,
          source_language: "en",
          target_language: "ar",
        }),
        method: "POST",
      }),
      { OPENAI_API_KEY: "test_key" },
    );
    const session = await createResponse.json() as { app_session_id: string };
    const reportResponse = await worker.fetch(
      new Request("https://worker.example/v1/report", {
        body: JSON.stringify({
          app_session_id: session.app_session_id,
          error_category: "inaccurate",
          optional_source_text_snapshot: "private source",
          revision: 1,
          source_language: "en",
          span_id: "span_report",
          target_language: "ar",
        }),
        method: "POST",
      }),
      {},
    );
    expect(reportResponse.status).toBe(202);
    const receipt = await reportResponse.json() as { report_id: string };

    const unconfigured = await worker.fetch(
      new Request("https://worker.example/v1/reports"),
      {},
    );
    expect(unconfigured.status).toBe(503);

    const unauthorized = await worker.fetch(
      new Request("https://worker.example/v1/reports"),
      { REPORT_ADMIN_TOKEN: "admin" },
    );
    expect(unauthorized.status).toBe(401);

    const listResponse = await worker.fetch(
      new Request("https://worker.example/v1/reports?limit=invalid", {
        headers: { Authorization: "Bearer admin" },
      }),
      { REPORT_ADMIN_TOKEN: "admin" },
    );
    expect(listResponse.status).toBe(200);
    const inbox = await listResponse.json() as { reports: Array<Record<string, unknown>> };
    expect(inbox.reports).toContainEqual(expect.objectContaining({
      report_id: receipt.report_id,
      retained_text_snapshot: true,
    }));
    expect(JSON.stringify(inbox)).not.toContain("private source");

    const deleteResponse = await worker.fetch(
      new Request(`https://worker.example/v1/reports/${receipt.report_id}`, {
        headers: { Authorization: "Bearer admin" },
        method: "DELETE",
      }),
      { REPORT_ADMIN_TOKEN: "admin" },
    );
    expect(deleteResponse.status).toBe(200);
    await expect(deleteResponse.json()).resolves.toEqual({ deleted: true });

    const missingDelete = await worker.fetch(
      new Request(`https://worker.example/v1/reports/${receipt.report_id}`, {
        headers: { Authorization: "Bearer admin" },
        method: "DELETE",
      }),
      { REPORT_ADMIN_TOKEN: "admin" },
    );
    expect(missingDelete.status).toBe(404);
  });

  it("returns not found for removed provider routes", async () => {
    const response = await worker.fetch(
      new Request("https://worker.example/v1/translate"),
      { OPENAI_API_KEY: "test_key" },
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "not_found" });
  });
});
