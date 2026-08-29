import * as Sentry from "@sentry/react-native";

export type MobileFailureContext = {
  app_session_id?: string;
  error_code?: string;
  operation: string;
  stage?: string;
};

let initialized = false;

export function initializeSentry(): void {
  if (initialized) {
    return;
  }
  initialized = true;
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN?.trim();
  Sentry.init({
    attachScreenshot: false,
    attachStacktrace: true,
    attachViewHierarchy: false,
    beforeBreadcrumb: () => null,
    beforeSend: sanitizeMobileEvent,
    debug: false,
    dsn,
    enabled: Boolean(dsn),
    enableAutoPerformanceTracing: true,
    enableAutoSessionTracking: true,
    enableCaptureFailedRequests: false,
    enableNativeCrashHandling: true,
    environment: __DEV__ ? "development" : "production",
    profilesSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    replaysSessionSampleRate: 0,
    sendDefaultPii: false,
    tracesSampleRate: __DEV__ ? 0 : 0.1,
  });
}

export function captureMobileFailure(
  failure: unknown,
  context: MobileFailureContext,
): void {
  const tags = {
    app_session_id: context.app_session_id ?? "none",
    error_code: context.error_code ?? "none",
    operation: context.operation,
    stage: context.stage ?? "unknown",
  };
  if (failure instanceof Error) {
    Sentry.captureException(failure, { tags });
    return;
  }
  Sentry.captureMessage(context.operation, {
    level: "error",
    tags,
  });
}

export function captureMobileFailureCode(context: MobileFailureContext): void {
  Sentry.captureMessage("mobile_operation_failed", {
    fingerprint: [context.operation, context.error_code ?? "unknown"],
    level: "error",
    tags: {
      app_session_id: context.app_session_id ?? "none",
      error_code: context.error_code ?? "unknown",
      operation: context.operation,
      stage: context.stage ?? "unknown",
    },
  });
}

export function sanitizeMobileEvent(event: Sentry.ErrorEvent): Sentry.ErrorEvent {
  const exception = event.exception
    ? {
        ...event.exception,
        values: event.exception.values?.map((value) => ({
          ...value,
          value: "mobile_operation_failed",
        })),
      }
    : undefined;
  return {
    ...event,
    breadcrumbs: undefined,
    exception,
    extra: undefined,
    message: event.message ? "mobile_operation_failed" : undefined,
    request: undefined,
    user: undefined,
  };
}
