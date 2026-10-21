// Registry version 1. Grow this from migrated sites, not hypothetical failures.
export type FailureClass = "defect" | "expected" | "dependency" | "unknown";
type FailureDefinition = {
  class: FailureClass;
  operation: string;
  description: string;
  retryable: boolean;
  main_action_affected: boolean;
};

export const failures = {
  "caption.retry_failed": {
    class: "unknown", operation: "caption_recovery", description: "Caption connection did not respond",
    retryable: true, main_action_affected: true,
  },
  "caption.recovery_exhausted": {
    class: "unknown", operation: "caption_recovery", description: "Caption recovery attempts were exhausted",
    retryable: false, main_action_affected: true,
  },
  "attribution.apple_http_failed": {
    class: "dependency", operation: "apple_attribution_request", description: "Apple attribution request returned an HTTP error",
    retryable: true, main_action_affected: false,
  },
  "attribution.apple_timeout": {
    class: "dependency", operation: "apple_attribution_request", description: "Apple attribution request timed out",
    retryable: true, main_action_affected: false,
  },
  "attribution.apple_network_failed": {
    class: "dependency", operation: "apple_attribution_request", description: "Apple attribution request could not reach the service",
    retryable: true, main_action_affected: false,
  },
  "attribution.apple_invalid_response": {
    class: "dependency", operation: "apple_attribution_response", description: "Apple attribution response was invalid",
    retryable: true, main_action_affected: false,
  },
  "attribution.rate_limiter_unavailable": {
    class: "dependency", operation: "attribution_rate_limit", description: "Install attribution rate limiter was unavailable",
    retryable: true, main_action_affected: false,
  },
  "attribution.failed": {
    class: "unknown", operation: "capture_install_attribution", description: "Install attribution did not complete",
    retryable: true, main_action_affected: false,
  },
  "billing.realtime_unavailable": {
    class: "unknown", operation: "realtime_billing", description: "Realtime billing did not complete",
    retryable: true, main_action_affected: true,
  },
  "worker.request_failed": {
    class: "unknown", operation: "http_request", description: "Worker request did not complete",
    retryable: false, main_action_affected: true,
  },
  "integrity.optional_rejected": {
    class: "expected", operation: "optional_play_integrity_verification", description: "Optional device check was not accepted",
    retryable: false, main_action_affected: false,
  },
  "integrity.optional_unavailable": {
    class: "expected", operation: "optional_play_integrity_verification", description: "Optional device check was unavailable",
    retryable: true, main_action_affected: false,
  },
  "integrity.configuration_invalid": {
    class: "defect", operation: "optional_play_integrity_verification", description: "Device check configuration was invalid",
    retryable: false, main_action_affected: false,
  },
  "integrity.optional_verification_failed": {
    class: "unknown", operation: "optional_play_integrity_verification", description: "Optional device check did not complete",
    retryable: false, main_action_affected: false,
  },
  "config.flags_timeout_fallback": {
    class: "expected", operation: "posthog_server_config", description: "Default feature configuration was used",
    retryable: true, main_action_affected: false,
  },
  "config.flags_request_invalid": {
    class: "defect", operation: "posthog_server_config", description: "Feature configuration request was invalid",
    retryable: false, main_action_affected: false,
  },
  "config.flags_credentials_invalid": {
    class: "defect", operation: "posthog_server_config", description: "Feature configuration credentials were invalid",
    retryable: false, main_action_affected: false,
  },
  "config.flags_unavailable": {
    class: "dependency", operation: "posthog_server_config", description: "Feature configuration service was unavailable",
    retryable: true, main_action_affected: false,
  },
  "config.flags_failed": {
    class: "unknown", operation: "posthog_server_config", description: "Feature configuration could not be loaded",
    retryable: false, main_action_affected: false,
  },
  // Until the mobile migration supplies typed causes, mobile failures stay visible as unknown.
  "mobile.operation_failed": {
    class: "unknown", operation: "mobile_operation", description: "Mobile operation did not complete",
    retryable: false, main_action_affected: true,
  },
} as const satisfies Record<string, FailureDefinition>;

export type FailureCode = keyof typeof failures;
export function isFailureCode(code: unknown): code is FailureCode {
  return typeof code === "string" && Object.hasOwn(failures, code);
}
export function failureDefinition(code: unknown) {
  return failures[isFailureCode(code) ? code : "worker.request_failed"];
}
export class OperationFailure extends Error {
  constructor(readonly code: FailureCode) {
    super(failures[code].description);
    this.name = "OperationFailure";
  }
}
