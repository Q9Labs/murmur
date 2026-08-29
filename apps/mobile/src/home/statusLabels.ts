import type { SessionPreparationStatus } from "../lib/live-translation/sessionPreparation";

export function getStatusText(
  status: string,
  error: string | null,
  preparationStatus?: SessionPreparationStatus,
): string {
  if (status === "requesting_mic_permission") {
    if (preparationStatus === "microphone_denied") {
      return "Microphone access needed";
    }
    return preparationStatus === "checking_device" ||
      preparationStatus === "ready" ||
      preparationStatus === "failed"
      ? "Checking device"
      : "Checking microphone";
  }
  const directStatus = directStatusText[status];
  if (directStatus) {
    return directStatus;
  }
  if (error) {
    return getErrorStatusText(error);
  }
  if (status === "idle") {
    return preparationStatusText[preparationStatus ?? "ready"];
  }
  return "Ready";
}

export function getHealthText(status: string, error: string | null): string {
  if (error === "realtime_transport_error" || status === "network_degraded") {
    return "Degraded";
  }
  if (status === "recovering") {
    return "Recovering";
  }
  if (status === "transport_disconnected") {
    return "Disconnected";
  }
  if (status === "live") {
    return "OK";
  }
  if (
    status === "connecting_realtime" ||
    status === "creating_session" ||
    status === "checking_device"
  ) {
    return "Connecting";
  }
  return "Ready";
}

const directStatusText: Record<string, string> = {
  ended: "Ended",
  live: "Health OK",
  network_degraded: "Network degraded",
  recovering: "Recovering",
  checking_device: "Checking device",
  connecting_realtime: "Starting AI",
  creating_session: "Starting AI",
  stopping: "Stopping",
  transport_disconnected: "Disconnected",
};

const preparationStatusText: Record<SessionPreparationStatus, string> = {
  checking_device: "Checking device",
  checking_microphone: "Checking microphone",
  failed: "Device check failed",
  idle: "Ready",
  microphone_denied: "Microphone access needed",
  ready: "Ready",
};

function getErrorStatusText(error: string): string {
  if (error === "realtime_transport_error") {
    return "Network degraded";
  }
  if (
    error === "provider_unavailable" ||
    error.startsWith("provider_unavailable_") ||
    error.startsWith("realtime_") ||
    error === "worker_session_network_error" ||
    error.startsWith("worker_session_http_")
  ) {
    return "Service unavailable";
  }
  if (error === "microphone_permission_denied") {
    return "Microphone access needed";
  }
  return "Needs setup";
}
