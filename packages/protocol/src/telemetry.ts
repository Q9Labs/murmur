import {
  isLanguageCode,
  isSourceLanguageCode,
  type LanguageCode,
  type SourceLanguageCode,
} from "./languages";
import type { ReportTranslationCategory } from "./transport/types";

export type TelemetryPlatform = "android" | "ios" | "web" | "unknown";

export type MobileTelemetryEvent =
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
      enabled: boolean;
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
  app_session_id?: unknown;
  app_version?: unknown;
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
  platform?: unknown;
  playback_enabled?: unknown;
  provider_elapsed_ms?: unknown;
  source_char_count?: unknown;
  source_language?: unknown;
  startup_latency_ms?: unknown;
  target_language?: unknown;
  translated_char_count?: unknown;
};

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
  switch (value.event) {
    case "mobile_app_opened":
    case "mobile_onboarding_completed":
      return parseAppLifecycleEvent(value, value.event);
    case "mobile_analytics_preference_changed":
      return parseAnalyticsPreferenceEvent(value);
    case "mobile_listen_tapped":
      return parseListenTappedEvent(value);
    case "mobile_session_live":
      return parseSessionLiveEvent(value);
    case "mobile_first_translation":
      return parseFirstTranslationEvent(value);
    case "mobile_session_failed":
      return parseSessionFailedEvent(value);
    case "mobile_session_completed":
      return parseSessionCompletedEvent(value);
    case "mobile_translation_reported":
      return parseTranslationReportedEvent(value);
    default:
      return null;
  }
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
    typeof value.enabled !== "boolean"
  ) {
    return null;
  }
  return {
    app_version: value.app_version,
    build_number: value.build_number,
    enabled: value.enabled,
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
  if (
    !hasLanguagePair(value) ||
    !isIdentifier(value.app_session_id) ||
    typeof value.committed_translation !== "boolean" ||
    !isDuration(value.duration_ms) ||
    !isNullableFailureCode(value.error_code) ||
    !isCount(value.input_audio_bytes) ||
    !isCount(value.input_audio_frames) ||
    !isShortLabel(value.network_type) ||
    (value.outcome !== "completed" && value.outcome !== "failed") ||
    typeof value.playback_enabled !== "boolean" ||
    !isCount(value.source_char_count) ||
    !isCount(value.translated_char_count)
  ) {
    return null;
  }
  return {
    app_session_id: value.app_session_id,
    committed_translation: value.committed_translation,
    duration_ms: value.duration_ms,
    error_code: value.error_code,
    event: "mobile_session_completed",
    input_audio_bytes: value.input_audio_bytes,
    input_audio_frames: value.input_audio_frames,
    network_type: value.network_type,
    outcome: value.outcome,
    playback_enabled: value.playback_enabled,
    source_char_count: value.source_char_count,
    source_language: value.source_language,
    target_language: value.target_language,
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

function isBoundedString(
  value: unknown,
  minimumLength: number,
  maximumLength: number,
): value is string {
  return typeof value === "string" &&
    value.length >= minimumLength &&
    value.length <= maximumLength;
}
