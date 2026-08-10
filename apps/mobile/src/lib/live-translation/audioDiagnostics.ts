import type { AudioFrameEvent } from "../../../modules/murmur-audio";

export type AudioCaptureDiagnostics = {
  bytes_received_by_js: number;
  duration_ms_received_by_js: number;
  first_frame_at_ms: number | null;
  frame_gaps_over_60ms: number;
  frames_received_by_js: number;
  frames_while_playback_active: number;
  last_audio_generation_id: number | null;
  last_event_seq: number | null;
  last_frame_at_ms: number | null;
  last_frame_rms: number | null;
  max_frame_gap_ms: number;
  peak_rms: number;
  peak_rms_while_playback_active: number;
  quiet_frame_rms_threshold: number;
  quiet_frames_while_playback_active: number;
  rms_average: number;
  rms_average_while_playback_active: number;
};

type AudioCaptureAccumulator = {
  bytesReceived: number;
  durationMsReceived: number;
  firstFrameAtMs: number | null;
  frameGapsOver60Ms: number;
  framesReceived: number;
  framesWhilePlaybackActive: number;
  lastAudioGenerationId: number | null;
  lastEventSeq: number | null;
  lastFrameAtMs: number | null;
  lastFrameRms: number | null;
  maxFrameGapMs: number;
  peakRms: number;
  peakRmsWhilePlaybackActive: number;
  quietFramesWhilePlaybackActive: number;
  rmsSum: number;
  rmsSumWhilePlaybackActive: number;
};

const quietFrameRmsThreshold = 0.005;

export function createAudioCaptureDiagnosticsTracker(): {
  recordFrame: (frame: AudioFrameEvent, playbackActive: boolean) => void;
  reset: () => void;
  snapshot: () => AudioCaptureDiagnostics;
} {
  let accumulator = createAccumulator();

  return {
    recordFrame(frame, playbackActive): void {
      const previousFrameAtMs = accumulator.lastFrameAtMs;
      if (
        previousFrameAtMs !== null &&
        accumulator.lastAudioGenerationId === frame.audio_generation_id
      ) {
        const gapMs = Math.max(0, frame.timestamp_ms - previousFrameAtMs);
        accumulator.maxFrameGapMs = Math.max(accumulator.maxFrameGapMs, gapMs);
        if (gapMs > 60) {
          accumulator.frameGapsOver60Ms += 1;
        }
      }
      accumulator.bytesReceived += frame.data.byteLength;
      accumulator.durationMsReceived += frame.duration_ms;
      accumulator.firstFrameAtMs ??= frame.timestamp_ms;
      accumulator.framesReceived += 1;
      accumulator.lastAudioGenerationId = frame.audio_generation_id;
      accumulator.lastEventSeq = frame.event_seq;
      accumulator.lastFrameAtMs = frame.timestamp_ms;
      accumulator.lastFrameRms = frame.rms;
      accumulator.peakRms = Math.max(accumulator.peakRms, frame.rms);
      accumulator.rmsSum += frame.rms;
      if (playbackActive) {
        accumulator.framesWhilePlaybackActive += 1;
        accumulator.peakRmsWhilePlaybackActive = Math.max(
          accumulator.peakRmsWhilePlaybackActive,
          frame.rms,
        );
        accumulator.rmsSumWhilePlaybackActive += frame.rms;
        if (frame.rms < quietFrameRmsThreshold) {
          accumulator.quietFramesWhilePlaybackActive += 1;
        }
      }
    },
    reset(): void {
      accumulator = createAccumulator();
    },
    snapshot(): AudioCaptureDiagnostics {
      return {
        bytes_received_by_js: accumulator.bytesReceived,
        duration_ms_received_by_js: accumulator.durationMsReceived,
        first_frame_at_ms: accumulator.firstFrameAtMs,
        frame_gaps_over_60ms: accumulator.frameGapsOver60Ms,
        frames_received_by_js: accumulator.framesReceived,
        frames_while_playback_active: accumulator.framesWhilePlaybackActive,
        last_audio_generation_id: accumulator.lastAudioGenerationId,
        last_event_seq: accumulator.lastEventSeq,
        last_frame_at_ms: accumulator.lastFrameAtMs,
        last_frame_rms: accumulator.lastFrameRms,
        max_frame_gap_ms: accumulator.maxFrameGapMs,
        peak_rms: accumulator.peakRms,
        peak_rms_while_playback_active: accumulator.peakRmsWhilePlaybackActive,
        quiet_frame_rms_threshold: quietFrameRmsThreshold,
        quiet_frames_while_playback_active: accumulator.quietFramesWhilePlaybackActive,
        rms_average: average(accumulator.rmsSum, accumulator.framesReceived),
        rms_average_while_playback_active: average(
          accumulator.rmsSumWhilePlaybackActive,
          accumulator.framesWhilePlaybackActive,
        ),
      };
    },
  };
}

function createAccumulator(): AudioCaptureAccumulator {
  return {
    bytesReceived: 0,
    durationMsReceived: 0,
    firstFrameAtMs: null,
    frameGapsOver60Ms: 0,
    framesReceived: 0,
    framesWhilePlaybackActive: 0,
    lastAudioGenerationId: null,
    lastEventSeq: null,
    lastFrameAtMs: null,
    lastFrameRms: null,
    maxFrameGapMs: 0,
    peakRms: 0,
    peakRmsWhilePlaybackActive: 0,
    quietFramesWhilePlaybackActive: 0,
    rmsSum: 0,
    rmsSumWhilePlaybackActive: 0,
  };
}

function average(sum: number, count: number): number {
  return count > 0 ? sum / count : 0;
}
