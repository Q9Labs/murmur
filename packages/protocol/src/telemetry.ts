import {
  isLanguageCode,
  isSourceLanguageCode,
  type LanguageCode,
  type SourceLanguageCode,
} from "./languages";
import type { ReportTranslationCategory } from "./transport/types";

export type TelemetryPlatform = "android" | "ios" | "web" | "unknown";

export type MobileBillingTelemetryEventName =
  | "mobile_allowance_exhausted"
  | "mobile_billing_screen_viewed"
  | "mobile_checkout_cancelled"
  | "mobile_checkout_failed"
  | "mobile_checkout_started"
  | "mobile_checkout_succeeded"
  | "mobile_low_balance_viewed"
  | "mobile_paywall_failed"
  | "mobile_paywall_opened"
  | "mobile_reconciliation_failed"
  | "mobile_reconciliation_succeeded"
  | "mobile_registration_completed"
  | "mobile_registration_started"
  | "mobile_restore_failed"
  | "mobile_restore_started"
  | "mobile_restore_succeeded";

export type MobileTelemetryEvent =
  | { event: "onboarding_step_viewed" | "onboarding_step_completed"; step: string }
  | { event: "plan_tab_viewed"; tab: "monthly" | "yearly" | "credit_packs" }
  | { event: "offer_shown" | "offer_redeemed"; offering_id: string }
  | { event: "account_saved"; method: "apple" | "google" | "email" }
  | { event: "store_review_prompted"; platform: "ios" | "android" }
  | {
      app_version: string;
      backend_environment: string;
      build_number: string;
      event: MobileBillingTelemetryEventName;
      package_label: string | null;
      platform: TelemetryPlatform;
      result_category: string | null;
    }
  | {
      app_version: string;
      build_number: string;
      event: "mobile_app_opened";
      platform: TelemetryPlatform;
    }
  | {
      app_version: string;
      build_number: string;
      event: "mobile_onboarding_completed";
      platform: TelemetryPlatform;
    }
  | {
      app_version: string;
      build_number: string;
      enabled: true;
      event: "mobile_analytics_preference_changed";
      platform: TelemetryPlatform;
    }
  | {
      event: "mobile_listen_tapped";
      network_type: string;
      playback_enabled: boolean;
      source_language: SourceLanguageCode;
      target_language: LanguageCode;
    }
  | {
      app_session_id: string;
      event: "mobile_session_live";
      source_language: SourceLanguageCode;
      startup_latency_ms: number;
      target_language: LanguageCode;
    }
  | {
      app_session_id: string;
      event: "mobile_first_translation";
      first_translation_latency_ms: number;
      provider_elapsed_ms: number | null;
    }
  | {
      app_session_id: string | null;
      duration_ms: number;
      error_code: string;
      event: "mobile_session_failed";
      failure_stage: MobileFailureStage;
      source_language: SourceLanguageCode;
      target_language: LanguageCode;
    }
  | {
      app_session_id: string;
      committed_translation: boolean;
      backgrounded?: boolean;
      capture_source?: "microphone" | "device_playback";
      duration_ms: number;
      error_code: string | null;
      event: "mobile_session_completed";
      input_audio_bytes: number;
      input_audio_frames: number;
      network_type: string;
      outcome: "completed" | "failed";
      playback_enabled: boolean;
      source_char_count: number;
      source_language: SourceLanguageCode;
      target_language: LanguageCode;
      translated_char_count: number;
    }
  | {
      app_session_id: string;
      error_category: ReportTranslationCategory;
      event: "mobile_translation_reported";
    };

export type MobileFailureStage =
  | "audio_capture"
  | "device_integrity"
  | "identity"
  | "microphone_permission"
  | "realtime_connection"
  | "session_creation"
  | "session_runtime";

export type MobileTelemetryRequest = {
  app_install_id: string;
  payload: MobileTelemetryEvent;
};

type TelemetryRequestCandidate = {
  app_install_id?: unknown;
  payload?: unknown;
};

type TelemetryEventCandidate = {
  answer?: unknown;
  backgrounded?: unknown;
  capture_source?: unknown;
  method?: unknown;
  offering_id?: unknown;
  stars?: unknown;
  step?: unknown;
  tab?: unknown;
  app_session_id?: unknown;
  app_version?: unknown;
  backend_environment?: unknown;
  build_number?: unknown;
  committed_translation?: unknown;
  duration_ms?: unknown;
  enabled?: unknown;
  error_category?: unknown;
  error_code?: unknown;
  event?: unknown;
  failure_stage?: unknown;
  first_translation_latency_ms?: unknown;
  input_audio_bytes?: unknown;
  input_audio_frames?: unknown;
  network_type?: unknown;
  outcome?: unknown;
  package_label?: unknown;
  platform?: unknown;
  playback_enabled?: unknown;
  provider_elapsed_ms?: unknown;
  result_category?: unknown;
  source_char_count?: unknown;
  source_language?: unknown;
  startup_latency_ms?: unknown;
  target_language?: unknown;
  translated_char_count?: unknown;
};

type TelemetryEventParser = (value: TelemetryEventCandidate) => MobileTelemetryEvent | null;

const billingEventNames: readonly MobileBillingTelemetryEventName[] = [
  "mobile_allowance_exhausted",
  "mobile_billing_screen_viewed",
  "mobile_checkout_cancelled",
  "mobile_checkout_failed",
  "mobile_checkout_started",
  "mobile_checkout_succeeded",
  "mobile_low_balance_viewed",
  "mobile_paywall_failed",
  "mobile_paywall_opened",
  "mobile_reconciliation_failed",
  "mobile_reconciliation_succeeded",
  "mobile_registration_completed",
  "mobile_registration_started",
  "mobile_restore_failed",
  "mobile_restore_started",
  "mobile_restore_succeeded",
];

const telemetryEventParsers = new Map<string, TelemetryEventParser>([
  ["onboarding_step_viewed", (value) => parseStepEvent(value, "onboarding_step_viewed")],
  ["onboarding_step_completed", (value) => parseStepEvent(value, "onboarding_step_completed")],
  ["plan_tab_viewed", (value) =>
    value.tab === "monthly" || value.tab === "yearly" || value.tab === "credit_packs"
      ? { event: "plan_tab_viewed", tab: value.tab } : null],
  ["offer_shown", (value) => parseOfferEvent(value, "offer_shown")],
  ["offer_redeemed", (value) => parseOfferEvent(value, "offer_redeemed")],
  ["account_saved", (value) =>
    value.method === "apple" || value.method === "google" || value.method === "email"
      ? { event: "account_saved", method: value.method } : null],
  ["store_review_prompted", (value) =>
    value.platform === "ios" || value.platform === "android"
      ? { event: "store_review_prompted", platform: value.platform } : null],
  ...billingEventNames.map((event): [string, TelemetryEventParser] => [
    event,
    (value) => parseBillingEvent(value, event),
  ]),
  ["mobile_app_opened", (value) => parseAppLifecycleEvent(value, "mobile_app_opened")],
  [
    "mobile_onboarding_completed",
    (value) => parseAppLifecycleEvent(value, "mobile_onboarding_completed"),
  ],
  ["mobile_analytics_preference_changed", parseAnalyticsPreferenceEvent],
  ["mobile_listen_tapped", parseListenTappedEvent],
  ["mobile_session_live", parseSessionLiveEvent],
  ["mobile_first_translation", parseFirstTranslationEvent],
  ["mobile_session_failed", parseSessionFailedEvent],
  ["mobile_session_completed", parseSessionCompletedEvent],
  ["mobile_translation_reported", parseTranslationReportedEvent],
]);

function parseStepEvent(
  value: TelemetryEventCandidate,
  event: "onboarding_step_viewed" | "onboarding_step_completed",
): MobileTelemetryEvent | null {
  return isShortLabel(value.step) ? { event, step: value.step } : null;
}

function parseOfferEvent(
  value: TelemetryEventCandidate,
  event: "offer_shown" | "offer_redeemed",
): MobileTelemetryEvent | null {
  return isShortLabel(value.offering_id) ? { event, offering_id: value.offering_id } : null;
}

export function parseMobileTelemetryRequest(value: unknown): MobileTelemetryRequest | null {
  if (!isTelemetryRequestCandidate(value)) {
    return null;
  }
  if (!isBoundedString(value.app_install_id, 8, 128)) {
    return null;
  }
  const payload = parseMobileTelemetryEvent(value.payload);
  return payload ? { app_install_id: value.app_install_id, payload } : null;
}

export function parseMobileTelemetryEvent(value: unknown): MobileTelemetryEvent | null {
  if (!isTelemetryEventCandidate(value) || typeof value.event !== "string") {
    return null;
  }
  return telemetryEventParsers.get(value.event)?.(value) ?? null;
}

function parseBillingEvent(
  value: TelemetryEventCandidate,
  event: MobileBillingTelemetryEventName,
): MobileTelemetryEvent | null {
  if (
    !hasAppIdentity(value) ||
    !isTelemetryPlatform(value.platform) ||
    !isShortLabel(value.backend_environment) ||
    !isNullableShortLabel(value.package_label) ||
    !isNullableShortLabel(value.result_category)
  ) {
    return null;
  }
  return {
    app_version: value.app_version,
    backend_environment: value.backend_environment,
    build_number: value.build_number,
    event,
    package_label: value.package_label,
    platform: value.platform,
    result_category: value.result_category,
  };
}

function parseAppLifecycleEvent(
  value: TelemetryEventCandidate,
  event: "mobile_app_opened" | "mobile_onboarding_completed",
): MobileTelemetryEvent | null {
  if (!hasAppIdentity(value) || !isTelemetryPlatform(value.platform)) {
    return null;
  }
  return {
    app_version: value.app_version,
    build_number: value.build_number,
    event,
    platform: value.platform,
  };
}

function parseAnalyticsPreferenceEvent(
  value: TelemetryEventCandidate,
): MobileTelemetryEvent | null {
  if (
    !hasAppIdentity(value) ||
    !isTelemetryPlatform(value.platform) ||
    value.enabled !== true
  ) {
    return null;
  }
  return {
    app_version: value.app_version,
    build_number: value.build_number,
    enabled: true,
    event: "mobile_analytics_preference_changed",
    platform: value.platform,
  };
}

function parseListenTappedEvent(value: TelemetryEventCandidate): MobileTelemetryEvent | null {
  if (
    !hasLanguagePair(value) ||
    !isShortLabel(value.network_type) ||
    typeof value.playback_enabled !== "boolean"
  ) {
    return null;
  }
  return {
    event: "mobile_listen_tapped",
    network_type: value.network_type,
    playback_enabled: value.playback_enabled,
    source_language: value.source_language,
    target_language: value.target_language,
  };
}

function parseSessionLiveEvent(value: TelemetryEventCandidate): MobileTelemetryEvent | null {
  if (
    !hasLanguagePair(value) ||
    !isIdentifier(value.app_session_id) ||
    !isDuration(value.startup_latency_ms)
  ) {
    return null;
  }
  return {
    app_session_id: value.app_session_id,
    event: "mobile_session_live",
    source_language: value.source_language,
    startup_latency_ms: value.startup_latency_ms,
    target_language: value.target_language,
  };
}

function parseFirstTranslationEvent(
  value: TelemetryEventCandidate,
): MobileTelemetryEvent | null {
  if (
    !isIdentifier(value.app_session_id) ||
    !isDuration(value.first_translation_latency_ms) ||
    !isOptionalDuration(value.provider_elapsed_ms)
  ) {
    return null;
  }
  return {
    app_session_id: value.app_session_id,
    event: "mobile_first_translation",
    first_translation_latency_ms: value.first_translation_latency_ms,
    provider_elapsed_ms: value.provider_elapsed_ms,
  };
}

function parseSessionFailedEvent(value: TelemetryEventCandidate): MobileTelemetryEvent | null {
  if (
    !hasLanguagePair(value) ||
    !isNullableIdentifier(value.app_session_id) ||
    !isDuration(value.duration_ms) ||
    !isFailureCode(value.error_code) ||
    !isFailureStage(value.failure_stage)
  ) {
    return null;
  }
  return {
    app_session_id: value.app_session_id,
    duration_ms: value.duration_ms,
    error_code: value.error_code,
    event: "mobile_session_failed",
    failure_stage: value.failure_stage,
    source_language: value.source_language,
    target_language: value.target_language,
  };
}

function parseSessionCompletedEvent(
  value: TelemetryEventCandidate,
): MobileTelemetryEvent | null {
  const context = parseSessionCompletionContext(value);
  const metrics = parseSessionCompletionMetrics(value);
  const metadata = parseSessionMetadata(value);
  if (!hasLanguagePair(value) || !isIdentifier(value.app_session_id) || !context || !metrics || !metadata) {
    return null;
  }
  return {
    app_session_id: value.app_session_id,
    ...context,
    event: "mobile_session_completed",
    ...metrics,
    ...metadata,
    source_language: value.source_language,
    target_language: value.target_language,
  };
}

function parseSessionMetadata(value: TelemetryEventCandidate): {
  backgrounded?: boolean;
  capture_source?: "microphone" | "device_playback";
} | null {
  if (value.backgrounded !== undefined && typeof value.backgrounded !== "boolean") return null;
  if (value.capture_source !== undefined &&
      value.capture_source !== "microphone" && value.capture_source !== "device_playback") return null;
  return {
    ...(typeof value.backgrounded === "boolean" ? { backgrounded: value.backgrounded } : {}),
    ...(value.capture_source === "microphone" || value.capture_source === "device_playback"
      ? { capture_source: value.capture_source } : {}),
  };
}

function parseSessionCompletionContext(value: TelemetryEventCandidate): {
  committed_translation: boolean;
  error_code: string | null;
  network_type: string;
  outcome: "completed" | "failed";
  playback_enabled: boolean;
} | null {
  if (
    typeof value.committed_translation !== "boolean" ||
    !isNullableFailureCode(value.error_code) ||
    !isShortLabel(value.network_type) ||
    (value.outcome !== "completed" && value.outcome !== "failed") ||
    typeof value.playback_enabled !== "boolean"
  ) {
    return null;
  }
  return {
    committed_translation: value.committed_translation,
    error_code: value.error_code,
    network_type: value.network_type,
    outcome: value.outcome,
    playback_enabled: value.playback_enabled,
  };
}

function parseSessionCompletionMetrics(value: TelemetryEventCandidate): {
  duration_ms: number;
  input_audio_bytes: number;
  input_audio_frames: number;
  source_char_count: number;
  translated_char_count: number;
} | null {
  if (
    !isDuration(value.duration_ms) ||
    !isCount(value.input_audio_bytes) ||
    !isCount(value.input_audio_frames) ||
    !isCount(value.source_char_count) ||
    !isCount(value.translated_char_count)
  ) {
    return null;
  }
  return {
    duration_ms: value.duration_ms,
    input_audio_bytes: value.input_audio_bytes,
    input_audio_frames: value.input_audio_frames,
    source_char_count: value.source_char_count,
    translated_char_count: value.translated_char_count,
  };
}

function parseTranslationReportedEvent(
  value: TelemetryEventCandidate,
): MobileTelemetryEvent | null {
  if (!isIdentifier(value.app_session_id) || !isReportCategory(value.error_category)) {
    return null;
  }
  return {
    app_session_id: value.app_session_id,
    error_category: value.error_category,
    event: "mobile_translation_reported",
  };
}

function isTelemetryRequestCandidate(value: unknown): value is TelemetryRequestCandidate {
  return typeof value === "object" && value !== null;
}

function isTelemetryEventCandidate(value: unknown): value is TelemetryEventCandidate {
  return typeof value === "object" && value !== null;
}

function hasAppIdentity(value: TelemetryEventCandidate): value is TelemetryEventCandidate & {
  app_version: string;
  build_number: string;
} {
  return isBoundedString(value.app_version, 1, 64) &&
    isBoundedString(value.build_number, 1, 64);
}

function hasLanguagePair(value: TelemetryEventCandidate): value is TelemetryEventCandidate & {
  source_language: SourceLanguageCode;
  target_language: LanguageCode;
} {
  return isSourceLanguageCode(value.source_language) && isLanguageCode(value.target_language);
}

function isTelemetryPlatform(value: unknown): value is TelemetryPlatform {
  return value === "android" || value === "ios" || value === "web" || value === "unknown";
}

function isFailureStage(value: unknown): value is MobileFailureStage {
  return value === "audio_capture" ||
    value === "device_integrity" ||
    value === "identity" ||
    value === "microphone_permission" ||
    value === "realtime_connection" ||
    value === "session_creation" ||
    value === "session_runtime";
}

function isReportCategory(value: unknown): value is ReportTranslationCategory {
  return value === "inaccurate" ||
    value === "offensive_harmful" ||
    value === "wrong_language" ||
    value === "speech_issue" ||
    value === "other";
}

function isDuration(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 86_400_000;
}

function isOptionalDuration(value: unknown): value is number | null {
  return value === null || isDuration(value);
}

function isCount(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 1_000_000_000;
}

function isIdentifier(value: unknown): value is string {
  return isBoundedString(value, 8, 128) && /^[a-zA-Z0-9_-]+$/.test(value);
}

function isNullableIdentifier(value: unknown): value is string | null {
  return value === null || isIdentifier(value);
}

function isFailureCode(value: unknown): value is string {
  return isBoundedString(value, 1, 160) && /^[a-z0-9_:,-]+$/.test(value);
}

function isNullableFailureCode(value: unknown): value is string | null {
  return value === null || isFailureCode(value);
}

function isShortLabel(value: unknown): value is string {
  return isBoundedString(value, 1, 64) && /^[a-zA-Z0-9_.:-]+$/.test(value);
}

function isNullableShortLabel(value: unknown): value is string | null {
  return value === null || isShortLabel(value);
}

function isBoundedString(
  value: unknown,
  minimumLength: number,
  maximumLength: number,
): value is string {
  return typeof value === "string" &&
    value.length >= minimumLength &&
    value.length <= maximumLength;
}
