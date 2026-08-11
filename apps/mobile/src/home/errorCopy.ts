export function formatLiveError(error: string): string {
  if (error.startsWith("provider_unconfigured")) {
    return "Live translation is not connected yet. Please try again after setup is complete.";
  }
  if (error.startsWith("provider_unavailable")) {
    return "Live translation provider is unavailable. Please try again.";
  }
  if (error === "allowance_exhausted" || error === "realtime_allowance_exhausted") {
    return "You’re out of translation time. Get more time or restore an existing purchase.";
  }
  if (error === "realtime_provider_quota_exhausted") {
    return "Murmur’s translation capacity is temporarily exhausted. Please try again later.";
  }
  if (error === "realtime_provider_rate_limited") {
    return "Translation is busy right now. Wait a moment, then try again.";
  }
  if (error === "realtime_provider_authentication_failed") {
    return "Murmur’s translation provider needs attention. Please contact support.";
  }
  if (error === "worker_session_network_error" || error.startsWith("worker_session_http_")) {
    return "Could not reach Murmur translation service. Check your connection and try again.";
  }
  if (error === "microphone_permission_denied") {
    return "Microphone access is required to translate speech.";
  }
  if (error === "microphone_start_failed") {
    return "Could not start the microphone. Please try again.";
  }
  if (error === "device_playback_permission_denied") {
    return "Phone audio needs audio recording and screen-sharing access. Murmur does not use the microphone in this mode.";
  }
  if (error === "device_playback_start_failed") {
    return "Could not start phone audio capture. The playing app may block capture.";
  }
  if (error === "device_playback_capture_revoked") {
    return "Phone audio capture stopped. Tap Listen to approve a new session.";
  }
  if (error === "device_playback_capture_stopped") {
    return "Phone audio capture ended. Return to Murmur and tap Listen to start again.";
  }
  if (error === "realtime_transport_error") {
    return `Translation connection was interrupted. Please try again. (${error})`;
  }
  if (error.startsWith("realtime_")) {
    return "Live translation is unavailable right now. Please try again.";
  }
  return `Live translation is unavailable. Please try again. (${error})`;
}

export function isAllowanceExhaustedError(error: string | null): boolean {
  return error === "allowance_exhausted" || error === "realtime_allowance_exhausted";
}

export function formatReportError(error: string): string {
  if (error === "report_rate_limited") {
    return "Too many reports were sent from this session. Please try again later.";
  }
  return "Could not send the report. Please try again.";
}
