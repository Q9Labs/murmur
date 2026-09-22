import type { LanguageCode, SourceLanguageCode } from "@murmur/protocol/languages";
import type { MobileTelemetryEvent } from "@murmur/protocol/telemetry";
import * as Sentry from "@sentry/cloudflare";

import type { Env } from "../env";

const postHogUsCaptureUrl = "https://us.i.posthog.com/i/v0/e/";

export type WorkerTelemetryEvent =
  | {
      event: "worker_billing_fulfillment";
      event_type: string;
      idempotent: boolean;
      provider: string;
      status: "applied" | "failed" | "ignored";
    }
  | {
      event: "worker_billing_reconciliation";
      purchase_count: number;
      status: "failed" | "succeeded";
      subscription_count: number;
      trigger: "login" | "purchase" | "restore";
    }
  | {
      acquisition_campaign?: string;
      acquisition_content?: string;
      acquisition_landing?: string;
      acquisition_medium?: string;
      acquisition_partner?: string;
      acquisition_source?: string;
      app_session_id: string;
      device_integrity_available: boolean;
      device_integrity_platform: string | null;
      device_integrity_provider: string | null;
      device_integrity_verified: boolean;
      event: "worker_session_created";
      source_language: SourceLanguageCode;
      target_language: LanguageCode;
    }
  | {
      app_session_id: string;
      event: "worker_realtime_opened";
      provider_connection_latency_ms: number;
      target_language: LanguageCode;
    }
  | {
      app_session_id: string;
      event: "worker_first_source" | "worker_first_translation";
      provider_elapsed_ms: number | null;
      worker_elapsed_ms: number;
    }
  | {
      app_session_id: string;
      close_reason: string | null;
      event: "worker_session_ended";
      failure_code: string | null;
      input_audio_bytes: number;
      input_audio_chunks: number;
      outcome: "completed" | "failed";
      session_duration_ms: number;
      source_received: boolean;
      translation_received: boolean;
    };

export type TelemetryExecutionContext = Pick<ExecutionContext, "waitUntil">;

export type RequestLocation = {
  city: string | null;
  country: string | null;
  region: string | null;
};

export function requestLocation(request: Request): RequestLocation {
  const cf = request.cf;
  return {
    city: typeof cf?.city === "string" ? cf.city : null,
    country: typeof cf?.country === "string" ? cf.country : null,
    region: typeof cf?.region === "string" ? cf.region : null,
  };
}

type PostHogCaptureParams = {
  distinct_id: string;
  env: Env;
  location?: RequestLocation;
  payload: MobileTelemetryEvent | WorkerTelemetryEvent;
};

function postHogLocationProperties(location?: RequestLocation) {
  return {
    $geoip_city_name: location?.city ?? null,
    $geoip_country_code: location?.country ?? null,
    $geoip_disable: true,
    $geoip_subdivision_1_name: location?.region ?? null,
    $ip: null,
  };
}

function postHogEventProperties(params: PostHogCaptureParams) {
  const { event, ...eventProperties } = params.payload;
  return {
    ...eventProperties,
    ...postHogLocationProperties(params.location),
    $process_person_profile: false,
    component: event.startsWith("mobile_") ? "mobile" : "worker",
    distinct_id: params.distinct_id,
    environment: params.env.MURMUR_ENV ?? "development",
    product: "murmur",
    telemetry_schema_version: 1,
  };
}

async function capturePostHogEvent(params: PostHogCaptureParams): Promise<void> {
  const apiKey = params.env.POSTHOG_PROJECT_TOKEN?.trim();
  if (!apiKey) {
    return;
  }
  const response = await fetch(postHogUsCaptureUrl, {
    body: JSON.stringify({
      api_key: apiKey,
      event: params.payload.event,
      properties: postHogEventProperties(params),
      timestamp: new Date().toISOString(),
      uuid: crypto.randomUUID(),
    }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
  if (!response.ok) {
    throw new Error(`posthog_capture_http_${response.status}`);
  }
}

export function queuePostHogEvent(params: PostHogCaptureParams & {
  context?: TelemetryExecutionContext;
}): void {
  const capture = capturePostHogEvent(params).catch((failure: unknown) => {
    Sentry.captureException(failure, {
      tags: {
        component: "worker",
        operation: "posthog_capture",
        product: "murmur",
        telemetry_event: params.payload.event,
      },
    });
  });
  if (params.context) {
    params.context.waitUntil(capture);
    return;
  }
  void capture;
}
