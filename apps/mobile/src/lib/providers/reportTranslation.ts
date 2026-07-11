import { getWorkerBaseUrl } from "../config";
import type {
  ReportTranslationRequest,
  ReportTranslationResponse,
} from "@murmur/protocol/transport/types";

export async function reportTranslation(
  request: ReportTranslationRequest,
): Promise<ReportTranslationResponse | { error: string }> {
  const response = await fetch(`${getWorkerBaseUrl()}/v1/report`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  const payload = (await response.json().catch(() => null)) as unknown;
  if (!response.ok || !payload) {
    return { error: `report_http_${response.status}` };
  }
  if (isErrorPayload(payload)) {
    return { error: payload.error };
  }
  return payload as ReportTranslationResponse;
}

function isErrorPayload(payload: unknown): payload is { error: string } {
  return (
    typeof payload === "object" &&
    payload !== null &&
    "error" in payload &&
    typeof (payload as { error?: unknown }).error === "string"
  );
}
