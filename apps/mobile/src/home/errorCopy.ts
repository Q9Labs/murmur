import { createTranslator, type Translate } from "../i18n/runtime";

const fallbackTranslate = createTranslator("en");

const exactLiveErrorCopy: Readonly<Record<string, string>> = {
  allowance_exhausted:
    "You’re out of translation time. Get more time or restore an existing purchase.",
  app_version_unsupported: "This version of Murmur is out of date. Update to keep translating.",
  client_upgrade_required: "This version of Murmur is out of date. Update to keep translating.",
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
  realtime_session_silence_timeout:
    "Translation stopped after two minutes without speech. Tap Listen to start again.",
  session_backgrounded:
    "Translation stopped when Murmur left the foreground. Return and tap Listen to start again.",
  session_silence_timeout:
    "Translation stopped after two minutes without speech. Tap Listen to start again.",
};

export function formatLiveError(error: string, translate: Translate = fallbackTranslate): string {
  const exactCopy = exactLiveErrorCopy[error];
  if (exactCopy) {
    return exactCopy;
  }
  if (error.startsWith("provider_unconfigured")) {
    return translate("error.providerUnconfigured");
  }
  if (error.startsWith("provider_unavailable")) {
    return translate("error.providerUnavailable");
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
  if (error === "worker_session_http_426") {
    return exactLiveErrorCopy.client_upgrade_required;
  }
  if (error === "worker_session_network_error" || error.startsWith("worker_session_http_")) {
    return translate("error.workerUnavailable");
  }
  if (error === "realtime_transport_error") {
    return translate("error.transport", { error });
  }
  if (error.startsWith("realtime_")) {
    return "Live translation is unavailable right now. Please try again.";
  }
  return translate("error.unavailable", { error });
}

export function isAllowanceExhaustedError(error: string | null): boolean {
  return error === "allowance_exhausted" || error === "realtime_allowance_exhausted";
}

export function isUpdateRequiredError(error: string | null): boolean {
  return error === "app_version_unsupported" ||
    error === "client_upgrade_required" ||
    error === "worker_session_http_426";
}

export function formatReportError(error: string, translate: Translate = fallbackTranslate): string {
  if (error === "report_rate_limited") {
    return translate("error.reportRateLimited");
  }
  return translate("error.reportFailed");
}
