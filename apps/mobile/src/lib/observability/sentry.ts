import * as Sentry from "@sentry/react-native";

import { type CaptureFailure, parseCaptureFailure } from "./captureFailure";
import { getStorageFailureDiagnostics } from "../storageDiagnostics";

import { getMurmurEnvironment, getSentryDsn } from "../config";

export type MobileFailureContext = {
  app_session_id?: string;
  error_code?: string;
  audio_capture?: CaptureFailure;
  install_attribution?:
    | {
        step: "android_referrer";
        response: "service_unavailable" | "developer_error" | "feature_not_supported"
          | "service_disconnected" | "remote_exception" | "unknown";
      }
    | { step: "deliver"; response?: "worker_route" | "unmarked" }
    | { step: "install_identity" | "ios_token" | "record" };
  external_link?: {
    target: "privacy" | "support" | "terms";
    step: "open_url";
    failure: "native_open_rejected" | "unspecified" | "unknown";
  };
  operation: string;
  stage?: string;
};

let initialized = false;

export function initializeSentry(): void {
  if (initialized) {
    return;
  }
  initialized = true;
  const dsn = getSentryDsn();
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
    environment: getMurmurEnvironment(),
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
  const errorCode = context.error_code ?? getFailureCode(failure) ?? "none";
  const tags = {
    app_session_id: context.app_session_id ?? "none",
    error_code: errorCode,
    operation: context.operation,
    stage: context.stage ?? "unknown",
    ...getStorageFailureDiagnostics(failure),
    ...(context.install_attribution ? {
      attribution_step: context.install_attribution.step,
      ...(context.install_attribution.step === "android_referrer" ? {
        install_referrer_response: context.install_attribution.response,
      } : {}),
      ...(context.install_attribution.step === "deliver" && context.install_attribution.response ? {
        attribution_response: context.install_attribution.response,
      } : {}),
    } : {}),
    ...(context.external_link ? {
      link_target: context.external_link.target,
      link_step: context.external_link.step,
      link_failure: context.external_link.failure,
    } : {}),
  };
  const fingerprint = [context.operation, tags.stage, errorCode];
  const contexts = context.audio_capture ? { audio_capture: context.audio_capture } : undefined;
  if (failure instanceof Error) {
    Sentry.captureException(failure, { fingerprint, tags, ...(contexts ? { contexts } : {}) });
    return;
  }
  Sentry.captureMessage(context.operation, {
    fingerprint,
    ...(contexts ? { contexts } : {}),
    level: "error",
    tags,
  });
}

function getFailureCode(failure: unknown): string | null {
  if (!(failure instanceof Error) || !("code" in failure) || typeof failure.code !== "string") {
    return null;
  }
  return /^[A-Za-z0-9_.-]{1,64}$/.test(failure.code) ? failure.code : null;
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
    contexts: event.contexts ? {
      ...event.contexts,
      audio_capture: parseCaptureFailure({ capture_failure: event.contexts.audio_capture }),
    } : undefined,
    exception,
    extra: undefined,
    message: event.message ? "mobile_operation_failed" : undefined,
    request: undefined,
    user: undefined,
  };
}
