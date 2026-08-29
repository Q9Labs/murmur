import type { MobileTelemetryRequest } from "@murmur/protocol/telemetry";

import { getWorkerBaseUrl } from "../config";

export async function deliverMobileTelemetryRequest(
  telemetry: MobileTelemetryRequest,
): Promise<void> {
  const response = await fetch(`${getWorkerBaseUrl()}/v1/telemetry`, {
    body: JSON.stringify(telemetry),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
  if (!response.ok) {
    throw new Error(`mobile_telemetry_http_${response.status}`);
  }
}
