import { expect, it, vi } from "vitest";

it("deploys the console guard before dependencies and protects full URL paths", async () => {
  const original = { ...console };
  const sink = vi.spyOn(console, "log").mockImplementation(() => {});
  try {
    const { default: worker } = await import("./entrypoint");
    const env = { MURMUR_ENV: "sandbox", MURMUR_DIAGNOSTICS_FIXTURE: "a".repeat(64) };
    const response = await worker.fetch(new Request("https://worker.example/__diagnostics/failure", { headers: { authorization: `Bearer ${env.MURMUR_DIAGNOSTICS_FIXTURE}` } }), env);
    expect(response.status).toBe(500);
    console.error(new Error("PRIVATE_DEPENDENCY_ERROR"));
    expect(sink).toHaveBeenCalledTimes(1);
    const sessionResponse = await worker.fetch(new Request("https://worker.example/v2/session", { method: "POST", body: JSON.stringify({ app_install_id: "private-install", source_language: "en", target_language: "ar" }) }), { OPENAI_API_KEY: "fixture", SESSION_HASH_SALT: "fixture" });
    const session = await sessionResponse.json();
    expect(sessionResponse.status).toBe(200);
    if (!session || typeof session !== "object" || !("app_session_id" in session)) throw new Error("Missing session response");
    const reportResponse = await worker.fetch(new Request("https://worker.example/v1/report", { method: "POST", body: JSON.stringify({ app_session_id: session.app_session_id, span_id: "span_12345678_i", revision: 1, error_category: "other", source_language: "en", target_language: "ar", optional_user_note: "PRIVATE_REPORT" }) }), { SESSION_HASH_SALT: "fixture" });
    expect(reportResponse.status).toBe(202);
    expect(sink.mock.calls.map(([line]) => JSON.parse(String(line)).event)).toContain("translation_reported");
    expect(JSON.stringify(sink.mock.calls)).not.toMatch(/PRIVATE_DEPENDENCY_ERROR|SYNTHETIC_PRIVATE_TRANSCRIPT/);
  } finally { Object.assign(console, original); sink.mockRestore(); }
});
