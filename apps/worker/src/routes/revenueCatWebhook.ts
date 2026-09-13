import * as Sentry from "@sentry/cloudflare";

import { isBillingFulfillmentEnabled, type Env } from "../env";
import { localizeRevenueCatEvent } from "../billing/revenueCatIdentity";
import {
  decodeIgnoredRevenueCatEvent,
  decodeRevenueCatEvent,
} from "../billing/revenueCatEvent";
import { processRevenueCatEvent } from "../billing/revenueCatProcessor";
import { verifyRevenueCatWebhook } from "../billing/revenueCatWebhookVerification";
import { json } from "../http/response";
import { queuePostHogEvent } from "../observability/posthog";

const maxWebhookBodyBytes = 256 * 1_024;

export async function receiveRevenueCatWebhook(
  request: Request,
  env: Env,
  context?: ExecutionContext,
): Promise<Response> {
  const rawBody = await readWebhookBody(request);
  if (rawBody === null) {
    return json({ error: "webhook_payload_too_large" }, 413);
  }
  if (!isBillingFulfillmentEnabled(env)) {
    return json({ error: "billing_fulfillment_disabled" }, 503);
  }
  const verified = await verifyRevenueCatWebhook({
    env,
    headers: request.headers,
    nowMs: Date.now(),
    rawBody,
  });
  if (!verified) {
    return json({ error: "invalid_webhook_signature" }, 401);
  }
  const payload = parseJson(rawBody);
  const decodedEvent = decodeRevenueCatEvent(payload);
  const event = decodedEvent ? localizeRevenueCatEvent(env, decodedEvent) : null;
  if (decodedEvent && !event) {
    queuePostHogEvent({
      context,
      distinct_id: decodedEvent.eventId,
      env,
      payload: {
        event: "worker_billing_fulfillment",
        event_type: decodedEvent.type,
        idempotent: false,
        provider: decodedEvent.provider ?? "unknown",
        status: "ignored",
      },
    });
    return json({ event_id: decodedEvent.eventId, idempotent: false, ignored: true, ok: true });
  }
  if (!event) {
    const ignored = decodeIgnoredRevenueCatEvent(payload);
    if (ignored) {
      return json({ event_id: ignored.eventId, idempotent: false, ok: true });
    }
    return json({ error: "invalid_webhook_payload" }, 400);
  }
  const result = await processRevenueCatEvent({
    env,
    event,
    nowMs: Date.now(),
    payloadHash: await sha256(rawBody),
  }).catch((failure: unknown) => {
    Sentry.captureException(failure, {
      tags: { operation: "process_revenuecat_webhook" },
    });
    return null;
  });
  if (!result || result.status === "failed") {
    queuePostHogEvent({
      context,
      distinct_id: event.eventId,
      env,
      payload: {
        event: "worker_billing_fulfillment",
        event_type: event.type,
        idempotent: false,
        provider: event.provider ?? "unknown",
        status: "failed",
      },
    });
    return json({ error: result?.code ?? "webhook_processing_failed" }, 503);
  }
  queuePostHogEvent({
    context,
    distinct_id: event.eventId,
    env,
    payload: {
      event: "worker_billing_fulfillment",
      event_type: event.type,
      idempotent: result.idempotent,
      provider: event.provider ?? "unknown",
      status: result.status,
    },
  });
  return json({ event_id: result.eventId, idempotent: result.idempotent, ok: true });
}

async function readWebhookBody(request: Request): Promise<string | null> {
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxWebhookBodyBytes) {
    return null;
  }
  if (!request.body) {
    return "";
  }
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let byteLength = 0;
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) {
      break;
    }
    byteLength += chunk.value.byteLength;
    if (byteLength > maxWebhookBodyBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(chunk.value);
  }
  const body = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(body);
}

function parseJson(rawBody: string): unknown {
  try {
    return JSON.parse(rawBody);
  } catch {
    return null;
  }
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
