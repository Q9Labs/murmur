import { describe, expect, it } from "vitest";

import { createSessionTimingTracker } from "./sessionTiming";

describe("session timing tracker", () => {
  it("records each Listen milestone once from the tap", () => {
    const timing = createSessionTimingTracker();
    timing.beginListen(1_000);

    expect(timing.recordListen("microphone_ready", 900)).toEqual({
      name: "listen_to_microphone_ready",
      value_ms: 0,
    });
    expect(timing.recordListen("identity_ready", 1_040)).toEqual({
      name: "listen_to_identity_ready",
      value_ms: 40,
    });
    expect(timing.recordListen("identity_ready", 1_050)).toBeNull();

    expect([
      timing.recordListen("integrity_ready", 1_060)?.name,
      timing.recordListen("worker_session_ready", 1_070)?.name,
      timing.recordListen("realtime_provider_ready", 1_080)?.name,
      timing.recordListen("capture_started", 1_090)?.name,
      timing.recordListen("first_source", 1_100)?.name,
      timing.recordListen("first_translation", 1_110)?.name,
    ]).toEqual([
      "listen_to_integrity_ready",
      "listen_to_worker_session_ready",
      "listen_to_realtime_provider_ready",
      "listen_to_capture_started",
      "listen_to_first_source",
      "listen_to_first_translation",
    ]);
  });

  it("records Stop cleanup independently and resets for the next session", () => {
    const timing = createSessionTimingTracker();
    timing.beginStop(2_000);

    expect(timing.recordStop("close_requested", 2_005)).toEqual({
      name: "stop_to_close_requested",
      value_ms: 5,
    });
    expect([
      timing.recordStop("capture_stopped", 2_020)?.name,
      timing.recordStop("provider_client_closed", 2_040)?.name,
      timing.recordStop("worker_session_close_completed", 2_060)?.name,
      timing.recordStop("playback_cleared_silenced", 2_080)?.name,
    ]).toEqual([
      "stop_to_capture_stopped",
      "stop_to_provider_client_closed",
      "stop_to_worker_session_close_completed",
      "stop_to_playback_cleared_silenced",
    ]);
    expect(timing.recordStop("ui_ended_start_enabled", 2_120)).toEqual({
      name: "stop_to_ui_ended_start_enabled",
      value_ms: 120,
    });

    timing.beginStop(3_000);
    expect(timing.recordStop("close_requested", 3_010)).toEqual({
      name: "stop_to_close_requested",
      value_ms: 10,
    });
  });
});
