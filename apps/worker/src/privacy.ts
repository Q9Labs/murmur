import { AsyncLocalStorage } from "node:async_hooks";
import { failureDefinition, isFailureCode } from "@murmur/protocol/diagnostics/failures";

export async function hashInstallId(installId: string, salt: string): Promise<string> {
  const bytes = new TextEncoder().encode(`${salt}:${installId}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

const logScope = new AsyncLocalStorage<boolean>();
let safeConsoleLog: ((line: string) => void) | undefined;

// Installed by the deployment entry point before SDKs evaluate. Dependencies may never
// write arbitrary arguments, exception messages, email addresses or provider responses.
export function installConsolePrivacyBoundary(): () => void {
  const original = Object.getOwnPropertyDescriptors(console);
  safeConsoleLog = console.log.bind(console);
  for (const key of Object.getOwnPropertyNames(console)) {
    if (typeof Reflect.get(console, key) === "function") Reflect.set(console, key, () => {});
  }
  return () => { Object.defineProperties(console, original); safeConsoleLog = undefined; };
}

// Cloudflare adds the ORIGINAL URL path to even custom logs. Query strings are redacted
// in Wrangler. Never emit on arbitrary paths, including malformed session/report IDs.
const staticPaths = new Set([
  "/", "/privacy", "/terms", "/support", "/health", "/ready", "/__diagnostics/failure",
  "/v1/session", "/v2/session", "/v2/realtime", "/v1/report", "/v1/reports",
  "/v1/diagnostics", "/v1/telemetry", "/v3/customer", "/v3/gifts/phone-audio/claim",
  "/v3/config", "/v3/insights/consent", "/v3/attribution", "/v3/ratings",
  "/v3/billing/reconcile", "/v3/webhooks/revenuecat",
  "/api/auth/sign-in/anonymous", "/api/auth/sign-in/email-otp", "/api/auth/email-otp/send-verification-otp",
  "/api/auth/get-session", "/api/auth/sign-out", "/api/auth/sign-in/social",
  "/api/auth/callback/apple", "/api/auth/callback/google", "/api/auth/delete-user",
]);
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
export function withRequestLogPrivacy<T>(request: Request, run: () => T): T {
  const url = new URL(request.url);
  const segment = url.pathname.match(/^\/v2\/session\/([^/]+)\/stop$/)?.[1] ??
    url.pathname.match(/^\/v1\/reports\/([^/]+)$/)?.[1];
  // cspell:ignore msbilal
  const safeHosts = ["murmur.q9labs.ai", "murmur-worker-production.msbilal.workers.dev", "murmur-worker-sandbox.msbilal.workers.dev", "murmur-worker-dev.msbilal.workers.dev", "worker.example", "localhost", "127.0.0.1"];
  const safe = safeHosts.includes(url.hostname) && /^(?:GET|POST|PUT|DELETE|OPTIONS|HEAD|PATCH)$/.test(request.method) &&
    !url.username && !url.password && (staticPaths.has(url.pathname) || Boolean(segment && uuid.test(segment)));
  return logScope.run(safe, run);
}

const legacyFields = {
  session_created: ["app_session_id", "hashed_install_id", "at_ms"],
  session_stop: ["app_session_id", "at_ms"],
  translation_reported: ["app_session_id", "report_id", "translation_span_id", "revision", "error_category", "retained_text_snapshot", "at_ms"],
  translation_report_forward_failed: ["app_session_id", "report_id", "reason", "at_ms"],
  revenuecat_reconciliation_completed: ["attempted", "failed"],
  abandoned_usage_sessions_closed: ["closed"],
  session_insight_retention_completed: ["deleted_insights", "deleted_session_contexts"],
  rating_survey_retention_completed: ["deleted_rating_surveys"],
  expired_auth_sessions_deleted: ["deleted_sessions"],
};
const counters = new Set(["at_ms", "revision", "attempted", "failed", "closed", "deleted_insights", "deleted_session_contexts", "deleted_rating_surveys", "deleted_sessions"]);
// Independent value predicates define the exported privacy contract; covered field by field.
// fallow-ignore-next-line complexity
function safeLegacyValue(key: string, value: unknown): unknown {
  if (key === "app_session_id" || key === "report_id") return typeof value === "string" && uuid.test(value) ? value : "[redacted]";
  if (key === "hashed_install_id" || key === "translation_span_id") return typeof value === "string" && /^[a-f0-9]{64}$/.test(value) ? value : "[redacted]";
  if (counters.has(key)) return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= 10_000_000_000_000 ? value : undefined;
  if (key === "retained_text_snapshot") return typeof value === "boolean" ? value : undefined;
  if (key === "error_category") return typeof value === "string" && ["inaccurate", "offensive_harmful", "wrong_language", "speech_issue", "other"].includes(value) ? value : undefined;
  if (key === "reason") return typeof value === "string" && /^(?:unconfigured|webhook_network_error|webhook_http_[1-5][0-9]{2})$/.test(value) ? value : undefined;
  return undefined;
}

// Reconstruct the fixed envelope at the untrusted boundary; never recursively pass through fields.
// fallow-ignore-next-line complexity
function safeOutcome(event: Record<string, unknown>): Record<string, unknown> | null {
  const attributes = event.attributes;
  if (!attributes || typeof attributes !== "object" || !("error_code" in attributes) || !isFailureCode(attributes.error_code)) return null;
  const definition = failureDefinition(attributes.error_code);
  const safeAttributes: Record<string, unknown> = { action: definition.operation, reason: definition.class, error_code: attributes.error_code, retryable: definition.retryable };
  if ("outcome" in attributes && typeof attributes.outcome === "string" && ["failed", "degraded", "rejected"].includes(attributes.outcome)) safeAttributes.outcome = attributes.outcome;
  if ("duration_ms" in attributes && typeof attributes.duration_ms === "number" && Number.isSafeInteger(attributes.duration_ms) && attributes.duration_ms >= 0 && attributes.duration_ms <= 86_400_000) safeAttributes.duration_ms = attributes.duration_ms;
  if ("source_surface" in attributes && (attributes.source_surface === "ios" || attributes.source_surface === "android")) safeAttributes.source_surface = attributes.source_surface;
  const record: Record<string, unknown> = { "service.name": "murmur-worker", body: definition.description, severity_text: definition.class === "expected" ? "INFO" : "ERROR", attributes: safeAttributes, synthetic: event.synthetic === true };
  if (typeof event._time === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(event._time) && Number.isFinite(Date.parse(event._time))) record._time = event._time;
  for (const key of ["trace_id", "span_id", "sentry_event_id"]) {
    const value = event[key];
    const pattern = key === "span_id" ? /^(?!0{16}$)[a-f0-9]{16}$/ : /^(?!0{32}$)[a-f0-9]{32}$/;
    if (typeof value === "string" && pattern.test(value)) record[key] = value;
  }
  if (typeof event["deployment.environment"] === "string" && ["production", "sandbox", "development"].includes(event["deployment.environment"])) record["deployment.environment"] = event["deployment.environment"];
  const release = event["service.version"];
  if (typeof release === "string" && /^(?:murmur-worker@\d{1,4}\.\d{1,4}\.\d{1,4}(?:\+[a-f0-9]{7,40})?|com\.q9labsai\.murmur@\d{1,4}\.\d{1,4}\.\d{1,4}\+\d{1,10})$/.test(release)) record["service.version"] = release;
  return record;
}

// This boundary reconstructs registered records. No recursive passthrough and no raw strings.
export function redactWorkerEvent(value: unknown): Record<string, unknown> | null {
  if (!isLogRecord(value)) return null;
  if (!("event" in value)) return safeOutcome(value);
  if (typeof value.event !== "string" || !Object.hasOwn(legacyFields, value.event)) return null;
  const record: Record<string, unknown> = { event: value.event };
  for (const [event, fields] of Object.entries(legacyFields)) {
    if (event !== value.event) continue;
    for (const key of fields) {
      const child = Object.getOwnPropertyDescriptor(value, key)?.value;
      const safe = safeLegacyValue(key, child);
      if (safe !== undefined) record[key] = safe;
    }
  }
  return record;
}

export function logWorkerEvent(event: unknown): boolean {
  if (logScope.getStore() === false) return false;
  const record = redactWorkerEvent(event);
  if (!record) return false;
  try {
    (safeConsoleLog ?? ((line: string) => console.log(line)))(JSON.stringify(record));
    return true;
  } catch {
    // A failed exporter must never affect a user request or recursively report itself.
    return false;
  }
}

function isLogRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
