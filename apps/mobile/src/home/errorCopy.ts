import type { MessageKey } from "../i18n/catalogs/en";
import { createTranslator, type Translate } from "../i18n/runtime";

const fallbackTranslate = createTranslator("en");

const exactLiveErrorKeys: Readonly<Partial<Record<string, MessageKey>>> = {
  allowance_exhausted: "liveError.outOfTime",
  app_version_unsupported: "liveError.updateRequired",
  client_upgrade_required: "liveError.updateRequired",
  device_playback_capture_revoked: "liveError.phoneAudioRevoked",
  device_playback_capture_stopped: "liveError.phoneAudioEnded",
  device_playback_permission_denied: "liveError.phoneAudioAccess",
  device_playback_start_failed: "liveError.phoneAudioStartFailed",
  microphone_permission_denied: "error.microphonePermission",
  microphone_start_failed: "error.microphoneStart",
  realtime_allowance_exhausted: "liveError.outOfTime",
  realtime_provider_authentication_failed: "liveError.providerAttention",
  realtime_provider_quota_exhausted: "liveError.capacity",
  realtime_provider_rate_limited: "liveError.busy",
  realtime_session_silence_timeout: "liveError.silence",
  session_backgrounded: "liveError.backgrounded",
  session_silence_timeout: "liveError.silence",
  worker_session_http_426: "liveError.updateRequired",
};

export function formatLiveError(error: string, translate: Translate = fallbackTranslate): string {
  const exactKey = exactLiveErrorKeys[error];
  if (exactKey) {
    return translate(exactKey);
  }
  if (error.startsWith("provider_unconfigured")) {
    return translate("error.providerUnconfigured");
  }
  if (error.startsWith("provider_unavailable")) {
    return translate("error.providerUnavailable");
  }
  if (error === "worker_session_network_error" || error.startsWith("worker_session_http_")) {
    return translate("error.workerUnavailable");
  }
  if (error === "realtime_transport_error") {
    return translate("error.transport", { error });
  }
  if (error.startsWith("realtime_")) {
    return translate("liveError.unavailable");
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
