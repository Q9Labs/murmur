import { parseMobileTelemetryRequest } from "@murmur/protocol/telemetry";

import type { Env } from "../env";
import { json } from "../http/response";
import { queuePostHogEvent, type TelemetryExecutionContext } from "../observability/posthog";
import { hashInstallId } from "../privacy";

const maxTelemetryBodyBytes = 8 * 1024;

export async function captureMobileTelemetry(
  request: Request,
  env: Env,
  context?: TelemetryExecutionContext,
): Promise<Response> {
  const contentLength = Number(request.headers.get("Content-Length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > maxTelemetryBodyBytes) {
    return json({ error: "telemetry_payload_too_large" }, 413);
  }
  const body: unknown = await request.json().catch(() => null);
  const telemetry = parseMobileTelemetryRequest(body);
  if (!telemetry) {
    return json({ error: "invalid_telemetry_event" }, 400);
  }
  const hashedInstallId = await hashInstallId(
    telemetry.app_install_id,
    env.SESSION_HASH_SALT ?? "local-development-salt",
  );
  queuePostHogEvent({
    context,
    distinct_id: `anonymous_install_${hashedInstallId}`,
    env,
    payload: telemetry.payload,
  });
  return json({ ok: true }, 202);
}
