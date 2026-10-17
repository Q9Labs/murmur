import { describe, expect, it, vi } from "vitest";
import { installConsolePrivacyBoundary, logWorkerEvent, redactWorkerEvent, withRequestLogPrivacy } from "./privacy";

const uuid = "12345678-1234-4234-8234-123456789abc";
const privateValue = "PRIVATE_TRANSCRIPT_SENTINEL";

describe("value-level log boundary", () => {
  it("drops unknown events and arbitrary keys, including innocently named strings", () => {
    expect(redactWorkerEvent({ event: privateValue, details: privateValue })).toBeNull();
    expect(redactWorkerEvent({ event: "session_created", acquisition: { campaign: privateValue }, source_language: privateValue, target_language: privateValue, extra: privateValue, app_session_id: uuid, at_ms: 123 })).toEqual({ event: "session_created", app_session_id: uuid, hashed_install_id: "[redacted]", at_ms: 123 });
  });

  it.each(["app_session_id", "report_id", "translation_span_id", "revision", "error_category", "retained_text_snapshot", "at_ms"])("does not retain arbitrary values in %s", (key) => {
    const record = redactWorkerEvent({ event: "translation_reported", [key]: privateValue });
    expect(JSON.stringify(record)).not.toContain(privateValue);
  });

  it("rejects objects disguised as safe enum strings", () => {
    const disguised = { toString: () => "other", secret: privateValue };
    expect(JSON.stringify(redactWorkerEvent({ event: "translation_reported", error_category: disguised }))).not.toContain(privateValue);
  });

  it("keeps only bounded counts, UUIDs, digests and registered enum values", () => {
    expect(redactWorkerEvent({ event: "translation_reported", app_session_id: uuid, report_id: uuid, translation_span_id: "a".repeat(64), revision: 1, error_category: "other", retained_text_snapshot: true, at_ms: 123 })).toEqual({ event: "translation_reported", app_session_id: uuid, report_id: uuid, translation_span_id: "a".repeat(64), revision: 1, error_category: "other", retained_text_snapshot: true, at_ms: 123 });
    expect(redactWorkerEvent({ event: "revenuecat_reconciliation_completed", attempted: NaN, failed: Infinity })).toEqual({ event: "revenuecat_reconciliation_completed" });
  });

  it("reconstructs outcomes from the registry, never caller messages or nested fields", () => {
    const record = redactWorkerEvent({ _time: privateValue, trace_id: privateValue, "service.version": privateValue, "deployment.environment": privateValue, body: privateValue, attributes: { error_code: "worker.request_failed", action: privateValue, reason: privateValue, extra: privateValue, duration_ms: privateValue } });
    expect(record).toMatchObject({ body: "Worker request did not complete", attributes: { action: "http_request", error_code: "worker.request_failed" } });
    expect(JSON.stringify(record)).not.toContain(privateValue);
  });

  it.each(["/v2/session/PRIVATE_TRANSCRIPT_SENTINEL/stop", "/v1/reports/PRIVATE_TRANSCRIPT_SENTINEL", "/api/auth/PRIVATE_TRANSCRIPT_SENTINEL", "/PRIVATE_TRANSCRIPT_SENTINEL"])("drops records when platform metadata would leak path %s", (path) => {
    const sink = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      expect(withRequestLogPrivacy(new Request(`https://worker.example${path}`), () => logWorkerEvent({ event: "session_stop", app_session_id: uuid }))).toBe(false);
      expect(sink).not.toHaveBeenCalled();
    } finally { sink.mockRestore(); }
  });

  it("retains a registered stop on a UUID path while dropping dependency console writes", () => {
    const sink = vi.spyOn(console, "log").mockImplementation(() => {});
    const restore = installConsolePrivacyBoundary();
    try {
      console.error(new Error(privateValue));
      console.log(privateValue);
      console.warn(privateValue);
      console.table({ email: privateValue });
      expect(withRequestLogPrivacy(new Request(`https://worker.example/v2/session/${uuid}/stop?email=${privateValue}`), () => logWorkerEvent({ event: "session_stop", app_session_id: uuid, details: privateValue }))).toBe(true);
      expect(sink).toHaveBeenCalledTimes(1);
      expect(JSON.stringify(sink.mock.calls)).not.toContain(privateValue);
    } finally { restore(); sink.mockRestore(); }
  });

  it("contains exporter failure without retries or recursive console writes", () => {
    const sink = vi.spyOn(console, "log").mockImplementation(() => { throw new Error(privateValue); });
    try { expect(logWorkerEvent({ event: "session_stop", app_session_id: uuid })).toBe(false); expect(sink).toHaveBeenCalledTimes(1); }
    finally { sink.mockRestore(); }
  });
});
