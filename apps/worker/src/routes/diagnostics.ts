import { getMurmurSession } from "../auth/auth";
import type { Env } from "../env";
import { json } from "../http/response";
import { diagnosticContext, isDiagnosticCode, safeRelease, writeOutcome } from "../observability/outcomes";
import { hashInstallId } from "../privacy";
import { canAcceptTelemetryDurable, isRateLimiterUnavailable } from "../rateLimitDurableObject";
import { readJsonWithinLimit } from "./telemetry";

type MobileOutcome = {
  trace_id: string;
  span_id: string;
  timestamp: string;
  release: string;
  source_surface: "ios" | "android";
  error_code: "mobile.operation_failed";
  outcome: "failed";
  duration_ms: number;
};
const fields = ["trace_id", "span_id", "timestamp", "release", "source_surface", "error_code", "outcome", "duration_ms"];

// This is the untrusted relay boundary: check every allowlisted field before any sink write.
// Malformed-field and size fixtures exercise these independent predicates.
// fallow-ignore-next-line complexity
function parseMobileOutcome(value: unknown, now: number): MobileOutcome | null {
  if (!value || typeof value !== "object" || Object.keys(value).some((key) => !fields.includes(key)) ||
    !("trace_id" in value) || !isDiagnosticCode(value.trace_id) ||
    !("span_id" in value) || typeof value.span_id !== "string" || !/^(?!0{16}$)[a-f0-9]{16}$/.test(value.span_id) ||
    !("timestamp" in value) || typeof value.timestamp !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value.timestamp) ||
    !Number.isFinite(Date.parse(value.timestamp)) || Math.abs(now - Date.parse(value.timestamp)) > 86_400_000 ||
    !("release" in value) || typeof value.release !== "string" || !value.release.startsWith("murmur-mobile@") || !safeRelease(value.release) ||
    !("source_surface" in value) || (value.source_surface !== "ios" && value.source_surface !== "android") ||
    !("error_code" in value) || value.error_code !== "mobile.operation_failed" ||
    !("outcome" in value) || value.outcome !== "failed" ||
    !("duration_ms" in value) || typeof value.duration_ms !== "number" || !Number.isSafeInteger(value.duration_ms) ||
    value.duration_ms < 0 || value.duration_ms > 86_400_000 || JSON.stringify(value).length > 2048) return null;
  return {
    trace_id: value.trace_id, span_id: value.span_id, timestamp: value.timestamp,
    release: value.release, source_surface: value.source_surface, error_code: value.error_code,
    outcome: value.outcome, duration_ms: value.duration_ms,
  };
}

export async function captureMobileDiagnostics(request: Request, env: Env, context?: ExecutionContext): Promise<Response> {
  // Authentication is independent of analytics consent and is never part of the exported record.
  if (!await getMurmurSession(request, env, context)) return json({ error: "authentication_required" }, 401);
  const address = request.headers.get("CF-Connecting-IP");
  if (!env.SESSION_HASH_SALT || !env.RATE_LIMITER || !address) return json({ error: "diagnostics_unavailable" }, 503);
  const limit = await canAcceptTelemetryDurable({
    hashed_client_id: await hashInstallId(`diagnostics:${address}`, env.SESSION_HASH_SALT),
    namespace: env.RATE_LIMITER, now_ms: Date.now(),
  });
  if (!limit.ok) return json({ error: limit.code }, isRateLimiterUnavailable(limit) ? 503 : 429);
  const body = await readJsonWithinLimit(request, 32 * 1024);
  if (body.kind === "too_large") return json({ error: "diagnostics_payload_too_large" }, 413);
  const value = body.value;
  if (!value || typeof value !== "object" || Object.keys(value).length !== 1 || !("events" in value) ||
    !Array.isArray(value.events) || value.events.length < 1 || value.events.length > 8) return json({ error: "invalid_diagnostics" }, 400);
  const events = value.events.map((event: unknown) => parseMobileOutcome(event, Date.now()));
  if (events.some((event) => !event)) return json({ error: "invalid_diagnostics" }, 400);
  // Validate the complete batch before the first write. Relayed events never capture to Sentry.
  for (const event of events) {
    if (!event) continue;
    const delivered = writeOutcome({
      context: { ...diagnosticContext(env), trace_id: event.trace_id, span_id: event.span_id, release: event.release, synthetic: false },
      code: event.error_code, outcome: event.outcome, duration_ms: event.duration_ms,
      timestamp: event.timestamp, source_surface: event.source_surface,
    });
    if (!delivered) return json({ error: "diagnostics_unavailable" }, 503);
  }
  return json({ ok: true }, 202);
}
