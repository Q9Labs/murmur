import * as Sentry from "@sentry/cloudflare";
import { OperationFailure } from "@murmur/protocol/diagnostics/failures";

import type { Env } from "../env";
import { json } from "../http/response";
import { queuePostHogEvent, type TelemetryExecutionContext } from "../observability/posthog";
import { hashInstallId } from "../privacy";
import { canAcceptTelemetryDurable, isRateLimiterUnavailable } from "../rateLimitDurableObject";

const limiterFailureReportWindowMs = 60_000;
let limiterFailureReportAt = Number.NEGATIVE_INFINITY;

type AttributionRequest =
  | { app_install_id: string; platform: "android"; referrer: string }
  | { app_install_id: string; platform: "ios"; token: string };

export async function captureInstallAttribution(
  request: Request,
  env: Env,
  context?: TelemetryExecutionContext,
): Promise<Response> {
  const body: unknown = await request.json().catch(() => null);
  const parsed = parseAttributionRequest(body);
  if (!parsed) return json({ error: "invalid_attribution" }, 400);
  const clientAddress = request.headers.get("CF-Connecting-IP") ?? parsed.app_install_id;
  const hashedClientId = await hashInstallId(
    `attribution-client:${clientAddress}`, env.SESSION_HASH_SALT ?? "local-development-salt",
  );
  const limit = await canAcceptTelemetryDurable({
    hashed_client_id: hashedClientId,
    namespace: env.RATE_LIMITER,
    now_ms: Date.now(),
  });
  if (!limit.ok) {
    if (isRateLimiterUnavailable(limit)) {
      reportLimiterFailure();
    }
    return json({ error: limit.code }, isRateLimiterUnavailable(limit) ? 503 : 429);
  }
  try {
    const attribution = parsed.platform === "android"
      ? parsePlayReferrer(parsed.referrer)
      : await resolveAppleAttribution(parsed.token);
    const hashedInstallId = await hashInstallId(
      parsed.app_install_id, env.SESSION_HASH_SALT ?? "local-development-salt",
    );
    queuePostHogEvent({
      context,
      distinct_id: `anonymous_install_${hashedInstallId}`,
      env,
      payload: {
        event: "install_attribution",
        platform: parsed.platform,
        source: attribution.source,
        campaign_id: attribution.campaignId,
      },
    });
    return json({ ok: true });
  } catch (failure) {
    Sentry.captureException(failure, { tags: {
      failure_code: failure instanceof OperationFailure ? failure.code : "attribution.failed",
      ...(failure instanceof AppleAttributionHttpFailure ? { upstream_status: String(failure.status) } : {}),
    } });
    return json({ error: "attribution_unavailable" }, 503);
  }
}

function reportLimiterFailure(): void {
  const now = Date.now();
  // This interval is per isolate and does not depend on the unavailable limiter.
  if (now - limiterFailureReportAt < limiterFailureReportWindowMs) return;
  limiterFailureReportAt = now;
  const failure = new OperationFailure("attribution.rate_limiter_unavailable");
  Sentry.captureException(failure, { tags: { failure_code: failure.code } });
}

function parseAttributionRequest(value: unknown): AttributionRequest | null {
  if (!hasAttributionIdentity(value)) return null;
  if (value.platform === "android") return parseAndroidAttribution(value);
  if (value.platform === "ios") return parseIosAttribution(value);
  return null;
}

function hasAttributionIdentity(value: unknown): value is {
  app_install_id: string;
  platform: unknown;
} {
  return typeof value === "object" && value !== null &&
    "app_install_id" in value && typeof value.app_install_id === "string" &&
    value.app_install_id.length >= 8 && value.app_install_id.length <= 128 &&
    "platform" in value;
}

function parseAndroidAttribution(
  value: { app_install_id: string; platform: unknown },
): AttributionRequest | null {
  if (!("referrer" in value) || typeof value.referrer !== "string" ||
      value.referrer.length > 2048) return null;
  return { app_install_id: value.app_install_id, platform: "android", referrer: value.referrer };
}

function parseIosAttribution(
  value: { app_install_id: string; platform: unknown },
): AttributionRequest | null {
  if (!("token" in value) || typeof value.token !== "string" ||
      value.token.length <= 20 || value.token.length > 10_000) return null;
  return { app_install_id: value.app_install_id, platform: "ios", token: value.token };
}

export function parsePlayReferrer(referrer: string): { campaignId: string | null; source: string } {
  const params = new URLSearchParams(referrer);
  const source = params.get("utm_source");
  const campaignId = params.get("utm_campaign");
  return {
    source: source && /^[a-zA-Z0-9_.-]{1,64}$/.test(source) ? source : "google_play",
    campaignId: campaignId && /^[a-zA-Z0-9_.-]{1,64}$/.test(campaignId) ? campaignId : null,
  };
}

async function resolveAppleAttribution(token: string): Promise<{ campaignId: string | null; source: string }> {
  const signal = AbortSignal.timeout(10_000);
  const response = await fetch("https://api-adservices.apple.com/api/v1/", {
    body: token,
    headers: { "Content-Type": "text/plain" },
    method: "POST",
    signal,
  }).catch((failure: unknown) => {
    throw appleTransportFailure(failure, signal);
  });
  if (!response.ok) throw new AppleAttributionHttpFailure(response.status);
  const value: unknown = await response.json().catch((failure: unknown) => {
    throw failure instanceof SyntaxError
      ? new OperationFailure("attribution.apple_invalid_response")
      : appleTransportFailure(failure, signal);
  });
  if (typeof value !== "object" || value === null || !("attribution" in value) ||
      typeof value.attribution !== "boolean") throw new OperationFailure("attribution.apple_invalid_response");
  const campaignId = "campaignId" in value && typeof value.campaignId === "number"
    ? String(value.campaignId) : null;
  return { campaignId, source: value.attribution ? "apple_ads" : "app_store" };
}

function appleTransportFailure(failure: unknown, signal: AbortSignal): OperationFailure {
  return new OperationFailure(signal.aborted || failure instanceof DOMException && failure.name === "TimeoutError"
    ? "attribution.apple_timeout" : "attribution.apple_network_failed");
}

class AppleAttributionHttpFailure extends OperationFailure {
  constructor(readonly status: number) {
    super("attribution.apple_http_failed");
  }
}
