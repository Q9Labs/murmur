export function formatLiveError(error: string): string {
  if (error.startsWith("provider_unconfigured")) {
    return "Live translation is not connected yet. Please try again after setup is complete.";
  }
  if (error.startsWith("provider_unavailable")) {
    return "Live translation provider is unavailable. Please try again.";
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
  if (error === "realtime_transport_error") {
    return `Translation connection was interrupted. Please try again. (${error})`;
  }
  if (error.startsWith("realtime_")) {
    return "Live translation is unavailable right now. Please try again.";
  }
  return `Live translation is unavailable. Please try again. (${error})`;
}

export function formatReportError(error: string): string {
  if (error === "report_rate_limited") {
    return "Too many reports were sent from this session. Please try again later.";
  }
  return "Could not send the report. Please try again.";
}
