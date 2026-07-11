export function formatLiveError(error: string): string {
  if (error.startsWith("provider_unconfigured")) {
    return "Live translation is not connected yet. Please try again after setup is complete.";
  }
  if (error.startsWith("provider_unavailable:deepgram")) {
    return "Speech recognition is not connected yet. Please try again after setup is complete.";
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
  if (error.startsWith("speech_unavailable")) {
    return `Speech unavailable. Translated captions can continue. (${error})`;
  }
  if (error === "translation_transport_error") {
    return `Translation connection was interrupted. Please try again. (${error})`;
  }
  if (error === "translation_transport_reconnecting") {
    return `Translation connection is reconnecting. Captions will continue shortly. (${error})`;
  }
  if (error === "translation_timeout") {
    return `A translation span timed out. Later captions will keep moving. (${error})`;
  }
  if (error.startsWith("provider_token_refresh_retrying")) {
    return `Provider session is refreshing. Captions will continue shortly. (${error})`;
  }
  if (error.startsWith("deepgram:")) {
    return `Speech recognition connection failed. Please try again. (${error})`;
  }
  return `Live translation is unavailable. Please try again. (${error})`;
}

export function formatReportError(error: string): string {
  if (error === "report_rate_limited") {
    return "Too many reports were sent from this session. Please try again later.";
  }
  return "Could not send the report. Please try again.";
}
