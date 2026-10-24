import type { CloudflareOptions, ErrorEvent, StackFrame } from "@sentry/cloudflare";
import { failureDefinition, isFailureCode } from "@murmur/protocol/diagnostics/failures";
import type { Env } from "../env";
import { sanitizeHttpFailureTags } from "./httpFailure";

export function getSentryOptions(env: Env): CloudflareOptions | undefined {
  const dsn = env.SENTRY_DSN?.trim();
  if (!dsn) return undefined;
  return {
    debug: false,
    enableLogs: false,
    beforeSend: sanitizeWorkerEvent,
    beforeSendTransaction: () => null,
    dataCollection: {
      cookies: false, databaseQueryData: false, frameContextLines: 0,
      genAI: { inputs: false, outputs: false },
      graphQL: { document: false, variables: false }, httpBodies: [],
      httpHeaders: { request: false, response: false },
      stackFrameVariables: false, urlQueryParams: false, userInfo: false,
    },
    dsn,
    environment: env.MURMUR_ENV ?? "development",
    release: env.SENTRY_RELEASE?.trim() || undefined,
    maxBreadcrumbs: 0,
    sendDefaultPii: false,
    tracesSampleRate: 0,
    transportOptions: {
      bufferSize: 16,
      fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(2_000) }),
    },
  };
}

function safeFrame(frame: StackFrame): StackFrame | undefined {
  // Keep only repository-relative code locations, never URLs, locals or source context.
  const filename = frame.filename?.match(/(?:^|\/)((?:apps\/worker\/src\/|src\/)[a-zA-Z0-9_/-]+\.[cm]?[jt]s|index\.js)$/)?.[1];
  if (!filename) return undefined;
  return {
    filename: `app:///${filename}`, in_app: true,
    ...(Number.isSafeInteger(frame.lineno) ? { lineno: frame.lineno } : {}),
    ...(Number.isSafeInteger(frame.colno) ? { colno: frame.colno } : {}),
  };
}

function safeBillingTags(tags: ErrorEvent["tags"]) {
  const allowed = {
    billing_failure_operation: ["periodic_settlement", "audio_metering", "audio_decode"],
    billing_failure_stage: ["periodic_settlement", "audio_metering", "audio_decode", "ledger_binding", "ledger_request", "ledger_decode", "ledger_result", "gift_settlement"],
    billing_failure_code: ["binding_missing", "request_failed", "decode_failed", "billing_unavailable", "customer_deleted", "customer_mismatch", "invalid_ledger_command", "usage_session_closed", "allowance_exhausted", "unexpected_result", "unexpected_error"],
  };
  const status = tags?.billing_failure_status;
  return {
    ...Object.fromEntries(Object.entries(allowed).flatMap(([key, values]) => {
      const value = tags?.[key];
      return typeof value === "string" && values.includes(value) ? [[key, value]] : [];
    })),
    ...(typeof status === "string" && /^[1-5][0-9]{2}$/.test(status) ? { billing_failure_status: status } : {}),
  };
}

export function sanitizeWorkerEvent(event: ErrorEvent): ErrorEvent {
  const code = isFailureCode(event.tags?.failure_code) ? event.tags.failure_code : "worker.request_failed";
  const definition = failureDefinition(code);
  const trace = event.tags?.trace_id;
  const upstreamStatus = event.tags?.upstream_status;
  return {
    type: undefined,
    event_id: event.event_id,
    timestamp: event.timestamp,
    platform: "javascript",
    level: event.level === "fatal" ? "fatal" : "error",
    // Release/environment come from trusted SDK initialization, not the thrown object.
    release: event.release?.match(/^murmur-worker@\d{1,4}\.\d{1,4}\.\d{1,4}\+[a-f0-9]{7,40}$/)?.[0],
    environment: ["production", "sandbox", "development"].includes(event.environment ?? "") ? event.environment : undefined,
    debug_meta: event.debug_meta ? {
      images: event.debug_meta.images?.flatMap((image) => {
        if (image.type !== "sourcemap" || !/^[a-f0-9-]{36}$/.test(image.debug_id)) return [];
        const filename = safeFrame({ filename: image.code_file })?.filename;
        return filename ? [{ type: "sourcemap", debug_id: image.debug_id, code_file: filename }] : [];
      }),
    } : undefined,
    tags: {
      failure_code: code, operation: definition.operation,
      ...(code === "worker.request_failed" ? sanitizeHttpFailureTags(event.tags) : {}),
      ...(code === "billing.realtime_unavailable" ? safeBillingTags(event.tags) : {}),
      ...(code === "attribution.apple_http_failed" && typeof upstreamStatus === "string" &&
        /^[1-5][0-9]{2}$/.test(upstreamStatus) ? { upstream_status: upstreamStatus } : {}),
      ...(typeof trace === "string" && /^(?!0{32}$)[a-f0-9]{32}$/.test(trace) ? { trace_id: trace } : {}),
    },
    ...(event.message ? { message: definition.description } : {}),
    exception: event.exception ? {
      values: event.exception.values?.slice(0, 4).map((value) => ({
        type: "Error", value: definition.description,
        stacktrace: value.stacktrace ? {
          frames: value.stacktrace.frames?.slice(-32).flatMap((frame) => {
            const safe = safeFrame(frame);
            return safe ? [safe] : [];
          }),
        } : undefined,
      })),
    } : undefined,
  };
}
