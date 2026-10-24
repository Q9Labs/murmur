import type { ErrorEvent } from "@sentry/cloudflare";

const routes = [
  "/health", "/ready", "/v3/customer", "/v3/gifts/phone-audio/claim", "/v3/config",
  "/v3/insights/consent", "/v3/attribution", "/v3/ratings", "/v3/billing/reconcile",
  "/v3/webhooks/revenuecat", "/v1/session", "/v2/session", "/v2/realtime",
  "/v1/diagnostics", "/v1/telemetry", "/v1/report", "/v1/reports",
  "/api/auth/*", "/v1/reports/:id", "/v2/session/:id/stop", "other",
];
const boundaries = ["http_handler", "auth_api"];
const categories = ["type_error", "range_error", "syntax_error", "abort", "timeout", "error", "non_error"];

function routeTemplate(request?: Request): string {
  if (!request) return "other";
  const path = new URL(request.url).pathname;
  if (path.startsWith("/api/auth/")) return "/api/auth/*";
  if (/^\/v1\/reports\/[^/]+$/.test(path)) return "/v1/reports/:id";
  if (/^\/v2\/session\/[^/]+\/stop$/.test(path)) return "/v2/session/:id/stop";
  // Return a value from the static list, never the request's path.
  return routes.find((route) => route === path) ?? "other";
}

function errorCategory(failure: unknown): string {
  if (failure instanceof TypeError) return "type_error";
  if (failure instanceof RangeError) return "range_error";
  if (failure instanceof SyntaxError) return "syntax_error";
  if (failure instanceof DOMException) {
    if (failure.name === "AbortError") return "abort";
    if (failure.name === "TimeoutError") return "timeout";
  }
  return failure instanceof Error ? "error" : "non_error";
}

export function httpFailureTags(
  http: { boundary: "http_handler" | "auth_api"; request?: Request; status?: number },
  failure: unknown,
) {
  return sanitizeHttpFailureTags({
    http_failure_boundary: http.boundary,
    http_failure_route: routeTemplate(http.request),
    http_failure_category: errorCategory(failure),
    http_failure_status: http.status === undefined ? undefined : String(http.status),
  });
}

export function sanitizeHttpFailureTags(tags: ErrorEvent["tags"]) {
  const allowed = {
    http_failure_boundary: boundaries,
    http_failure_route: routes,
    http_failure_category: categories,
  };
  const status = tags?.http_failure_status;
  return {
    ...Object.fromEntries(Object.entries(allowed).flatMap(([key, values]) => {
      const value = tags?.[key];
      return typeof value === "string" && values.includes(value) ? [[key, value]] : [];
    })),
    ...(typeof status === "string" && /^[1-5][0-9]{2}$/.test(status) ? { http_failure_status: status } : {}),
  };
}
