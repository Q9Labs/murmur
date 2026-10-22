import type { AudioCaptureSource } from "../../../modules/murmur-audio";
import { parseCaptureFailure } from "../observability/captureFailure";
import { captureMobileFailure } from "../observability/sentry";

const unexpectedDevicePlaybackStopReasons = new Set([
  "capture_read_failed",
  "service_destroy",
  "system_stop",
  "task_removed",
]);

export function getDevicePlaybackCaptureError(reason: string): string | null {
  if (reason === "device_playback_capture_revoked") {
    return "device_playback_capture_revoked";
  }
  return unexpectedDevicePlaybackStopReasons.has(reason)
    ? "device_playback_capture_stopped"
    : null;
}

export async function startAudioCapture({ audio, source, maxSessionSeconds, appSessionId }: {
  audio: {
    startCapture(source: AudioCaptureSource, maxSessionSeconds: number): Promise<unknown>;
    getAudioState(): Promise<unknown>;
  };
  source: AudioCaptureSource;
  maxSessionSeconds: number;
  appSessionId: string;
}): Promise<void> {
  try {
    await audio.startCapture(source, maxSessionSeconds);
  } catch (failure) {
    // Reading diagnostics must never hide the original capture failure.
    const state = await audio.getAudioState().catch(() => null);
    captureMobileFailure(failure, {
      app_session_id: appSessionId,
      operation: source === "microphone" ? "start_microphone_capture" : "start_device_playback_capture",
      stage: "audio_capture",
      audio_capture: parseCaptureFailure(state),
    });
    throw failure;
  }
}
