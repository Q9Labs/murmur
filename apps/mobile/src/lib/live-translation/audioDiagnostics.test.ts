import { describe, expect, it } from "vitest";

import { createAudioCaptureDiagnosticsTracker } from "./audioDiagnostics";

describe("audio capture diagnostics", () => {
  it("tracks frame continuity, levels, and playback overlap", () => {
    const tracker = createAudioCaptureDiagnosticsTracker();
    tracker.recordFrame(frame({ eventSeq: 1, rms: 0.1, timestampMs: 1_000 }), false);
    tracker.recordFrame(frame({ eventSeq: 2, rms: 0.004, timestampMs: 1_020 }), true);
    tracker.recordFrame(frame({ eventSeq: 3, rms: 0.02, timestampMs: 1_100 }), true);

    expect(tracker.snapshot()).toMatchObject({
      bytes_received_by_js: 2_880,
      duration_ms_received_by_js: 60,
      first_frame_at_ms: 1_000,
      frame_gaps_over_60ms: 1,
      frames_received_by_js: 3,
      frames_while_playback_active: 2,
      last_event_seq: 3,
      last_frame_at_ms: 1_100,
      max_frame_gap_ms: 80,
      peak_rms: 0.1,
      peak_rms_while_playback_active: 0.02,
      quiet_frames_while_playback_active: 1,
      rms_average: (0.1 + 0.004 + 0.02) / 3,
      rms_average_while_playback_active: (0.004 + 0.02) / 2,
    });
  });

  it("resets gap tracking across capture generations", () => {
    const tracker = createAudioCaptureDiagnosticsTracker();
    tracker.recordFrame(frame({ eventSeq: 1, generation: 1, timestampMs: 1_000 }), false);
    tracker.recordFrame(frame({ eventSeq: 2, generation: 2, timestampMs: 2_000 }), false);

    expect(tracker.snapshot().frame_gaps_over_60ms).toBe(0);
    tracker.reset();
    expect(tracker.snapshot().frames_received_by_js).toBe(0);
  });
});

function frame({
  eventSeq,
  generation = 1,
  rms = 0.01,
  timestampMs,
}: {
  eventSeq: number;
  generation?: number;
  rms?: number;
  timestampMs: number;
}) {
  return {
    audio_generation_id: generation,
    data: new Uint8Array(960),
    duration_ms: 20,
    event_seq: eventSeq,
    rms,
    sample_rate: 24_000 as const,
    timestamp_ms: timestampMs,
  };
}
