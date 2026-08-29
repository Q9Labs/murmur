import type { CloudflareOptions } from "@sentry/cloudflare";
import type { ErrorEvent } from "@sentry/cloudflare";

import type { Env } from "../env";

export function getSentryOptions(env: Env): CloudflareOptions | undefined {
  const dsn = env.SENTRY_DSN?.trim();
  if (!dsn) {
    return undefined;
  }
  return {
    beforeSend: sanitizeWorkerEvent,
    dataCollection: {
      cookies: false,
      databaseQueryData: false,
      frameContextLines: 3,
      genAI: { inputs: false, outputs: false },
      graphQL: { document: false, variables: false },
      httpBodies: [],
      httpHeaders: { request: { allow: ["cf-ray"] }, response: false },
      stackFrameVariables: false,
      urlQueryParams: false,
      userInfo: false,
    },
    dsn,
    environment: env.MURMUR_ENV ?? "development",
    release: env.SENTRY_RELEASE?.trim() || undefined,
    tracesSampleRate: env.MURMUR_ENV === "production" ? 0.1 : 0,
  };
}

export function sanitizeWorkerEvent(event: ErrorEvent): ErrorEvent {
  const exception = event.exception
    ? {
        ...event.exception,
        values: event.exception.values?.map((value) => ({
          ...value,
          value: "worker_operation_failed",
        })),
      }
    : undefined;
  const request = event.request
    ? {
        method: event.request.method,
        url: stripQueryString(event.request.url),
      }
    : undefined;
  return {
    ...event,
    breadcrumbs: undefined,
    exception,
    extra: undefined,
    message: event.message ? "worker_operation_failed" : undefined,
    request,
    user: undefined,
  };
}

function stripQueryString(url: string | undefined): string | undefined {
  if (!url) {
    return undefined;
  }
  const queryStart = url.indexOf("?");
  return queryStart >= 0 ? url.slice(0, queryStart) : url;
}
