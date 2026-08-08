export function getStatusText(status: string, error: string | null): string {
  const directStatus = directStatusText[status];
  if (directStatus) {
    return directStatus;
  }
  if (error) {
    return getErrorStatusText(error);
  }
  if (status === "creating_session" || status.startsWith("connecting")) {
    return "Connecting";
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
    status === "creating_session"
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
  requesting_mic_permission: "Microphone",
  transport_disconnected: "Disconnected",
};

function getErrorStatusText(error: string): string {
  if (error === "realtime_transport_error") {
    return "Network degraded";
  }
  return "Needs setup";
}
