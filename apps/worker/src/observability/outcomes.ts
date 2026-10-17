import { AsyncLocalStorage } from "node:async_hooks";
import * as Sentry from "@sentry/cloudflare";
import { failures, OperationFailure, type FailureCode } from "@murmur/protocol/diagnostics/failures";
import type { Env } from "../env";
import { logWorkerEvent } from "../privacy";

export function isDiagnosticCode(value: unknown): value is string {
  return typeof value === "string" && /^(?!0{32}$)[0-9a-f]{32}$/.test(value);
}
function randomDiagnosticCode(): string {
  return crypto.randomUUID().replaceAll("-", "");
}
export function safeRelease(value: unknown): string | undefined {
  return typeof value === "string" && /^(?:murmur-worker@\d{1,4}\.\d{1,4}\.\d{1,4}(?:\+[a-f0-9]{7,40})?|com\.q9labsai\.murmur@\d{1,4}\.\d{1,4}\.\d{1,4}\+\d{1,10})$/.test(value)
    ? value : undefined;
}

type OutcomeContext = {
  trace_id: string;
  span_id: string;
  environment: "development" | "sandbox" | "production";
  release?: string;
  synthetic: boolean;
};
const requestContext = new AsyncLocalStorage<OutcomeContext>();
export function diagnosticContext(env: Env): OutcomeContext {
  return requestContext.getStore() ?? {
    trace_id: randomDiagnosticCode(), span_id: randomDiagnosticCode().slice(0, 16),
    environment: env.MURMUR_ENV === "production" ? "production" : env.MURMUR_ENV === "sandbox" ? "sandbox" : "development",
    release: safeRelease(env.SENTRY_RELEASE), synthetic: false,
  };
}

// One fixed log record, following q9stack's OTel logs recipe. No arbitrary metadata.
export function writeOutcome(params: {
  context: OutcomeContext;
  code: FailureCode;
  outcome: "failed" | "degraded" | "rejected";
  duration_ms: number;
  sentry_event_id?: string;
  source_surface?: "ios" | "android";
  timestamp?: string;
}): boolean {
  const definition = failures[params.code];
  const record = {
    _time: params.timestamp ?? new Date().toISOString(),
    trace_id: params.context.trace_id,
    span_id: params.context.span_id,
    "service.name": "murmur-worker",
    "service.version": params.context.release,
    "deployment.environment": params.context.environment,
    body: definition.description,
    severity_text: definition.class === "expected" ? "INFO" : "ERROR",
    attributes: {
      action: definition.operation, reason: definition.class, error_code: params.code,
      outcome: params.outcome, duration_ms: Math.min(86_400_000, Math.max(0, Math.round(params.duration_ms))),
      retryable: definition.retryable,
      ...(params.source_surface ? { source_surface: params.source_surface } : {}),
    },
    synthetic: params.context.synthetic,
    ...(params.sentry_event_id ? { sentry_event_id: params.sentry_event_id } : {}),
  };
  try {
    // This is the only outcome sink. Changing destination must not change the record.
    return logWorkerEvent(record);
  } catch {
    // No retries, secondary exporter or Sentry recursion. Delivery markers land in PR 3.
    return false;
  }
}

export function reportFailure(params: {
  code: FailureCode;
  failure?: unknown;
  env: Env;
  duration_ms: number;
  outcome?: "failed" | "degraded" | "rejected";
}): string {
  const context = diagnosticContext(params.env);
  const definition = failures[params.code];
  let eventId: string | undefined;
  if (definition.class === "defect" || definition.class === "unknown") {
    try {
      // Preserve stack locations, never the provider's message, type, or custom fields.
      const error = new Error(definition.description);
      if (params.failure instanceof Error) error.stack = params.failure.stack;
      eventId = Sentry.captureException(error, {
        tags: { failure_code: params.code, operation: definition.operation, trace_id: context.trace_id },
      });
    } catch {
      // A broken SDK cannot replace the application's result or invoke another exporter.
    }
  }
  writeOutcome({
    context, code: params.code, outcome: params.outcome ?? "failed",
    duration_ms: params.duration_ms, sentry_event_id: eventId,
  });
  return context.trace_id;
}

export function syntheticFailure(request: Request, env: Env): void {
  if (env.MURMUR_ENV !== "sandbox" || !env.MURMUR_DIAGNOSTICS_FIXTURE ||
    !/^[a-f0-9]{64}$/.test(env.MURMUR_DIAGNOSTICS_FIXTURE) ||
    request.headers.get("Authorization") !== `Bearer ${env.MURMUR_DIAGNOSTICS_FIXTURE}`) return;
  const context = requestContext.getStore();
  if (context) context.synthetic = true;
  throw new TypeError("SYNTHETIC_PRIVATE_TRANSCRIPT secret=fixture-only");
}

export async function withHttpDiagnostics(
  request: Request, env: Env, run: () => Promise<Response>,
): Promise<Response> {
  const incoming = request.headers.get("traceparent");
  const trace = incoming?.match(/^00-((?!0{32})[a-f0-9]{32})-(?!0{16})[a-f0-9]{16}-[a-f0-9]{2}$/)?.[1];
  const context = { ...diagnosticContext(env), trace_id: trace ?? randomDiagnosticCode() };
  return requestContext.run(context, async () => {
    const start = Date.now();
    let response: Response;
    try {
      response = await run();
    } catch (failure) {
      reportFailure({
        code: failure instanceof OperationFailure ? failure.code : "worker.request_failed",
        failure, env, duration_ms: Date.now() - start,
      });
      response = new Response(JSON.stringify({ error: "worker_operation_failed", diagnostic_code: context.trace_id }), {
        status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }
    // Do not reconstruct WebSocket upgrade responses (their socket must be preserved).
    if (response.status !== 101) {
      response = new Response(response.body, response);
      response.headers.set("X-Diagnostic-Code", context.trace_id);
      response.headers.set("Access-Control-Expose-Headers", "X-Diagnostic-Code");
    }
    return response;
  });
}
