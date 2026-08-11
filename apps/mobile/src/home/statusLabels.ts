import { createTranslator, type Translate } from "../i18n/runtime";

const fallbackTranslate = createTranslator("en");

export function getStatusText(
  status: string,
  error: string | null,
  translate: Translate = fallbackTranslate,
): string {
  const directStatus = directStatusText[status];
  if (directStatus) {
    return translate(directStatus);
  }
  if (error) {
    return getErrorStatusText(error, translate);
  }
  if (status === "creating_session" || status.startsWith("connecting")) {
    return translate("status.connecting");
  }
  return translate("status.ready");
}

export function getHealthText(
  status: string,
  error: string | null,
  translate: Translate = fallbackTranslate,
): string {
  if (error === "realtime_transport_error" || status === "network_degraded") {
    return translate("status.degraded");
  }
  if (status === "recovering") {
    return translate("status.recovering");
  }
  if (status === "transport_disconnected") {
    return translate("status.disconnected");
  }
  if (status === "live") {
    return translate("status.ok");
  }
  if (
    status === "connecting_realtime" ||
    status === "creating_session"
  ) {
    return translate("status.connecting");
  }
  return translate("status.ready");
}

const directStatusText: Record<string, Parameters<Translate>[0]> = {
  ended: "status.ended",
  live: "status.healthOk",
  network_degraded: "status.networkDegraded",
  recovering: "status.recovering",
  requesting_mic_permission: "status.microphone",
  transport_disconnected: "status.disconnected",
};

function getErrorStatusText(error: string, translate: Translate): string {
  if (error === "realtime_transport_error") {
    return translate("status.networkDegraded");
  }
  return translate("status.needsSetup");
}
