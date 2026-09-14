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
