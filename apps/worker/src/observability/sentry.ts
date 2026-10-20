import type { CloudflareOptions, ErrorEvent, StackFrame } from "@sentry/cloudflare";
import { failureDefinition, isFailureCode } from "@murmur/protocol/diagnostics/failures";
import type { Env } from "../env";

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
