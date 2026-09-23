import type { LanguageCode, SourceLanguageCode } from "@murmur/protocol/languages";
import type { MobileTelemetryEvent } from "@murmur/protocol/telemetry";
import * as Sentry from "@sentry/cloudflare";

import type { Env } from "../env";

const postHogUsCaptureUrl = "https://us.i.posthog.com/i/v0/e/";

export type WorkerTelemetryEvent =
  | {
      event: "install_attribution";
      platform: "ios" | "android";
      source: string;
      campaign_id: string | null;
    }
  | {
      event: "session_insight";
      setting: string;
      speakers_estimate: "1" | "2" | "3+";
      translation_quality: number;
      sentiment: "positive" | "neutral" | "negative";
      duration_ms: number;
      source_language: string;
      target_language: string;
    }
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
      capture_source: "microphone" | "phone_audio";
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

type PostHogCaptureParams = {
  country?: string;
  distinct_id: string;
  env: Env;
  payload: MobileTelemetryEvent | WorkerTelemetryEvent;
};

function postHogEventProperties(params: PostHogCaptureParams) {
  const { event, ...eventProperties } = params.payload;
  return {
    ...eventProperties,
    $geoip_disable: true,
    $ip: null,
    $process_person_profile: false,
    component: event.startsWith("mobile_") ? "mobile" : "worker",
    ...(params.country ? { country: params.country } : {}),
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
