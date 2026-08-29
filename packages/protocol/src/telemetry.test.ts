import { describe, expect, it } from "vitest";

import { parseMobileTelemetryRequest } from "./telemetry";

describe("parseMobileTelemetryRequest", () => {
  it("accepts a content-free completed session event", () => {
    expect(parseMobileTelemetryRequest({
      app_install_id: "install_12345678",
      payload: {
        app_session_id: "session_12345678",
        committed_translation: true,
        duration_ms: 61_000,
        error_code: null,
        event: "mobile_session_completed",
        input_audio_bytes: 240_000,
        input_audio_frames: 120,
        network_type: "WIFI",
        outcome: "completed",
        playback_enabled: true,
        source_char_count: 42,
        source_language: "en",
        target_language: "ar",
        translated_char_count: 51,
      },
    })).toEqual({
      app_install_id: "install_12345678",
      payload: {
        app_session_id: "session_12345678",
        committed_translation: true,
        duration_ms: 61_000,
        error_code: null,
        event: "mobile_session_completed",
        input_audio_bytes: 240_000,
        input_audio_frames: 120,
        network_type: "WIFI",
        outcome: "completed",
        playback_enabled: true,
        source_char_count: 42,
        source_language: "en",
        target_language: "ar",
        translated_char_count: 51,
      },
    });
  });

  it("rejects conversation content and unknown event shapes", () => {
    expect(parseMobileTelemetryRequest({
      app_install_id: "install_12345678",
      payload: {
        event: "mobile_session_completed",
        source_caption: "private speech",
      },
    })).toBeNull();
  });

  it("rejects unbounded labels and invalid numeric values", () => {
    expect(parseMobileTelemetryRequest({
      app_install_id: "install_12345678",
      payload: {
        event: "mobile_session_failed",
        app_session_id: null,
        duration_ms: -1,
        error_code: "private speech with spaces",
        failure_stage: "session_creation",
        source_language: "en",
        target_language: "ar",
      },
    })).toBeNull();
  });
});
