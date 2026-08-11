import { createTranslator, type Translate } from "../i18n/runtime";

const fallbackTranslate = createTranslator("en");

export function formatLiveError(error: string, translate: Translate = fallbackTranslate): string {
  if (error.startsWith("provider_unconfigured")) {
    return translate("error.providerUnconfigured");
  }
  if (error.startsWith("provider_unavailable")) {
    return translate("error.providerUnavailable");
  }
  if (error === "worker_session_network_error" || error.startsWith("worker_session_http_")) {
    return translate("error.workerUnavailable");
  }
  if (error === "microphone_permission_denied") {
    return translate("error.microphonePermission");
  }
  if (error === "microphone_start_failed") {
    return translate("error.microphoneStart");
  }
  if (error === "realtime_transport_error") {
    return translate("error.transport", { error });
  }
  if (error.startsWith("realtime_")) {
    return translate("error.realtimeFailure", { error });
  }
  return translate("error.unavailable", { error });
}

export function formatReportError(error: string, translate: Translate = fallbackTranslate): string {
  if (error === "report_rate_limited") {
    return translate("error.reportRateLimited");
  }
  return translate("error.reportFailed");
}
