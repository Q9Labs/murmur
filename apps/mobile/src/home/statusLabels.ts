import type { MessageKey } from "../i18n/catalogs/en";
import { createTranslator, type Translate } from "../i18n/runtime";
import type { SessionPreparationStatus } from "../lib/live-translation/sessionPreparation";

const fallbackTranslate = createTranslator("en");

export function getStatusText(
  status: string,
  error: string | null,
  preparationStatus?: SessionPreparationStatus,
  translate: Translate = fallbackTranslate,
): string {
  if (status === "requesting_mic_permission") {
    if (preparationStatus === "microphone_denied") {
      return translate("home.microphoneAccessNeeded");
    }
    return preparationStatus === "checking_device" ||
      preparationStatus === "ready" ||
      preparationStatus === "failed"
      ? translate("status.checkingDevice")
      : translate("status.checkingMicrophone");
  }
  const directStatus = directStatusText[status];
  if (directStatus) {
    return translate(directStatus);
  }
  if (error) {
    return getErrorStatusText(error, translate);
  }
  if (status === "idle") {
    return translate(preparationStatusText[preparationStatus ?? "ready"]);
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
    status === "creating_session" ||
    status === "checking_device"
  ) {
    return translate("status.connecting");
  }
  return translate("status.ready");
}

const directStatusText: Partial<Record<string, MessageKey>> = {
  ended: "status.ended",
  live: "home.listening",
  network_degraded: "status.networkDegraded",
  requesting_audio_permission: "status.audioAccess",
  recovering: "status.recovering",
  checking_device: "status.checkingDevice",
  connecting_realtime: "status.startingAi",
  creating_session: "status.startingAi",
  stopping: "status.stopping",
  transport_disconnected: "status.disconnected",
};

const preparationStatusText: Record<SessionPreparationStatus, MessageKey> = {
  checking_device: "status.checkingDevice",
  checking_microphone: "status.checkingMicrophone",
  failed: "status.deviceCheckFailed",
  idle: "status.ready",
  microphone_denied: "home.microphoneAccessNeeded",
  ready: "status.ready",
};

function getErrorStatusText(error: string, translate: Translate): string {
  if (error === "realtime_transport_error") {
    return translate("status.networkDegraded");
  }
  if (
    error === "provider_unavailable" ||
    error.startsWith("provider_unavailable_") ||
    error.startsWith("realtime_") ||
    error === "worker_session_network_error" ||
    error.startsWith("worker_session_http_")
  ) {
    return translate("status.serviceUnavailable");
  }
  if (error === "microphone_permission_denied") {
    return translate("home.microphoneAccessNeeded");
  }
  if (error === "device_playback_permission_denied") {
    return translate("status.phoneAudioAccessNeeded");
  }
  return translate("status.needsSetup");
}
