import { createSpan } from "@murmur/protocol/session";
import { describe, expect, it, vi } from "vitest";

import { logWorkerEvent, redactWorkerEvent } from "./privacy";

describe("worker privacy logging", () => {
  it("redacts transcript, translation, audio, and token-like fields recursively", () => {
    expect(
      redactWorkerEvent({
        app_session_id: "session_123",
        nested: {
          authorization: "Bearer secret",
          source_caption: "hello",
          translated_caption: "مرحبا",
          provider: {
            api_key: "provider_key",
            token_bundle_id: "bundle_123",
          },
        },
        optional_user_note: "bad translation",
        pcm_audio: "base64_audio",
      }),
    ).toEqual({
      app_session_id: "[redacted]",
      nested: {
        authorization: "[redacted]",
        source_caption: "[redacted]",
        translated_caption: "[redacted]",
        provider: {
          api_key: "[redacted]",
          token_bundle_id: "[redacted]",
        },
      },
      optional_user_note: "[redacted]",
      pcm_audio: "[redacted]",
    });
  });

  it.each(["app_session_id", "span_id", "trace_id", "request_id", "sentry_event_id", "hashed_install_id", "userId", "requestID", "nested.request-id"])(
    "replaces private values in id-shaped field %s", (key) => {
      expect(redactWorkerEvent({ [key]: "PRIVATE_TRANSCRIPT_SENTINEL" })).toEqual({ [key]: "[redacted]" });
      expect(redactWorkerEvent({ [key]: ["PRIVATE_TRANSCRIPT_SENTINEL"] })).toEqual({ [key]: "[redacted]" });
    },
  );

  it("rejects raw translation spans even when private words fit their format", () => {
    const span = createSpan();
    expect(redactWorkerEvent({ translation_span_id: span.span_id })).toEqual({ translation_span_id: "[redacted]" });
    expect(redactWorkerEvent({ translation_span_id: "span_password_personal" })).toEqual({ translation_span_id: "[redacted]" });
    expect(redactWorkerEvent({ translation_span_id: "a".repeat(64) })).toEqual({ translation_span_id: "a".repeat(64) });
    expect(redactWorkerEvent({ translation_span_id: "PRIVATE_TRANSCRIPT_SENTINEL" }))
      .toEqual({ translation_span_id: "[redacted]" });
    expect(redactWorkerEvent({ span_id: span.span_id })).toEqual({ span_id: "[redacted]" });
  });

  it("keeps only well-formed UUIDs and fixed-length hex ids", () => {
    const safe = { app_session_id: "12345678-1234-4234-8234-123456789abc", trace_id: "1".repeat(32),
      span_id: "2".repeat(16), hashed_install_id: "3".repeat(64), request_id: "4".repeat(32) };
    expect(redactWorkerEvent(safe)).toEqual(safe);
    expect(redactWorkerEvent({ span_id: "1".repeat(32), trace_id: "0".repeat(32), app_session_id: "not-a-uuid" }))
      .toEqual({ span_id: "[redacted]", trace_id: "[redacted]", app_session_id: "[redacted]" });
  });

  it("logs only the redacted worker event", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    try {
      logWorkerEvent({
        event: "translation_reported",
        optional_source_text_snapshot: "hello",
        report_id: "report_123",
      });
      expect(spy).toHaveBeenCalledWith(
        JSON.stringify({
          event: "translation_reported",
          optional_source_text_snapshot: "[redacted]",
          report_id: "[redacted]",
        }),
      );
    } finally {
      spy.mockRestore();
    }
  });
});
