const exactLiveErrorCopy: Readonly<Record<string, string>> = {
  allowance_exhausted:
    "You’re out of translation time. Get more time or restore an existing purchase.",
  device_playback_capture_revoked:
    "Phone audio capture stopped. Tap Listen to approve a new session.",
  device_playback_capture_stopped:
    "Phone audio capture ended. Return to Murmur and tap Listen to start again.",
  device_playback_permission_denied:
    "Phone audio needs audio recording and screen-sharing access. Murmur does not use the microphone in this mode.",
  device_playback_start_failed:
    "Could not start phone audio capture. The playing app may block capture.",
  microphone_permission_denied: "Microphone access is required to translate speech.",
  microphone_start_failed: "Could not start the microphone. Please try again.",
  realtime_allowance_exhausted:
    "You’re out of translation time. Get more time or restore an existing purchase.",
  realtime_provider_authentication_failed:
    "Murmur’s translation provider needs attention. Please contact support.",
  realtime_provider_quota_exhausted:
    "Murmur’s translation capacity is temporarily exhausted. Please try again later.",
  realtime_provider_rate_limited:
    "Translation is busy right now. Wait a moment, then try again.",
};

export function formatLiveError(error: string): string {
  const exactCopy = exactLiveErrorCopy[error];
  if (exactCopy) {
    return exactCopy;
  }
  if (error.startsWith("provider_unconfigured")) {
    return "Live translation is not connected yet. Please try again after setup is complete.";
  }
  if (error.startsWith("provider_unavailable")) {
    return "Live translation provider is unavailable. Please try again.";
  }
  if (error === "worker_session_network_error" || error.startsWith("worker_session_http_")) {
    return "Could not reach Murmur translation service. Check your connection and try again.";
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
