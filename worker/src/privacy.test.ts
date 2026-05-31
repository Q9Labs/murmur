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
      app_session_id: "session_123",
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
          report_id: "report_123",
        }),
      );
    } finally {
      spy.mockRestore();
    }
  });
});
