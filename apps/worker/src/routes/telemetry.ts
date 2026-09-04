import { parseMobileTelemetryRequest } from "@murmur/protocol/telemetry";

import type { Env } from "../env";
import { json } from "../http/response";
import { queuePostHogEvent, type TelemetryExecutionContext } from "../observability/posthog";
import { hashInstallId } from "../privacy";
import {
  canAcceptTelemetryDurable,
  isRateLimiterUnavailable,
} from "../rateLimitDurableObject";

const maxTelemetryBodyBytes = 8 * 1024;

export async function captureMobileTelemetry(
  request: Request,
  env: Env,
  context?: TelemetryExecutionContext,
): Promise<Response> {
  const bodyResult = await readJsonWithinLimit(request, maxTelemetryBodyBytes);
  if (bodyResult.kind === "too_large") {
    return json({ error: "telemetry_payload_too_large" }, 413);
  }
  const telemetry = parseMobileTelemetryRequest(bodyResult.value);
  if (!telemetry) {
    return json({ error: "invalid_telemetry_event" }, 400);
  }
  const salt = env.SESSION_HASH_SALT ?? "local-development-salt";
  const clientAddress = request.headers.get("CF-Connecting-IP");
  const hashedClientId = await hashInstallId(
    clientAddress
      ? `telemetry-network:${clientAddress}`
      : `telemetry-install:${telemetry.app_install_id}`,
    salt,
  );
  const limit = await canAcceptTelemetryDurable({
    hashed_client_id: hashedClientId,
    namespace: env.RATE_LIMITER,
    now_ms: Date.now(),
  });
  if (!limit.ok) {
    if (isRateLimiterUnavailable(limit)) {
      return json({ error: limit.code }, 503);
    }
    return json(
      { error: limit.code, retry_after_ms: limit.retry_after_ms },
      429,
    );
  }
  const hashedInstallId = await hashInstallId(
    telemetry.app_install_id,
    salt,
  );
  queuePostHogEvent({
    context,
    distinct_id: `anonymous_install_${hashedInstallId}`,
    env,
    payload: telemetry.payload,
  });
  return json({ ok: true }, 202);
}

type BoundedJsonResult =
  | { kind: "json"; value: unknown }
  | { kind: "too_large" };

async function readJsonWithinLimit(
  request: Request,
  maxBytes: number,
): Promise<BoundedJsonResult> {
  const declaredLength = Number(request.headers.get("Content-Length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    return { kind: "too_large" };
  }
  if (!request.body) {
    return { kind: "json", value: null };
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) {
      break;
    }
    totalBytes += chunk.value.byteLength;
    if (totalBytes > maxBytes) {
      await reader.cancel("telemetry_payload_too_large");
      return { kind: "too_large" };
    }
    chunks.push(chunk.value);
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return { kind: "json", value: JSON.parse(new TextDecoder().decode(body)) };
  } catch {
    return { kind: "json", value: null };
  }
}
