import {
  autoSourceLanguageCode,
  isLanguageCode,
  isSourceLanguageCode,
  type LanguageCode,
  type SourceLanguageCode,
} from "@murmur/protocol/languages";
import {
  defaultTranslationModelRoute,
  isTranslationModelRoute,
} from "@murmur/protocol/translationModelRoutes";
import type {
  SummaryRequest,
  TranslationMode,
  TranslationModelRoute,
  TranslationRequest,
} from "@murmur/protocol/transport/types";

export const sessionSummaryCharLimit = 700;
const summarySourceCharLimit = 5000;

type EnvWithMode = {
  MURMUR_ENV?: string;
};

export function validateTranslationRequest(request: TranslationRequest): string | null {
  return (
    validateTranslationRequestIdentity(request) ??
    validateTranslationRequestContent(request) ??
    validateTranslationRequestOptions(request) ??
    validateTranslationRequestContext(request)
  );
}

function isIntegerAtLeast(value: unknown, minimum: number): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= minimum;
}

function isStringAtLeast(value: unknown, minimumLength: number): value is string {
  return typeof value === "string" && value.length >= minimumLength;
}

function validateTranslationRequestIdentity(request: TranslationRequest): string | null {
  if (!isStringAtLeast(request.app_session_id, 8)) {
    return "invalid_session_id";
  }
  if (
    typeof request.client_request_id !== "undefined" &&
    !isStringAtLeast(request.client_request_id, 4)
  ) {
    return "invalid_client_request_id";
  }
  if (!isStringAtLeast(request.connection_id, 8)) {
    return "invalid_connection_id";
  }
  if (!isIntegerAtLeast(request.session_epoch, 1)) {
    return "invalid_session_epoch";
  }
  if (!isIntegerAtLeast(request.event_seq, 1)) {
    return "invalid_event_seq";
  }
  if (!isStringAtLeast(request.span_id, 4)) {
    return "invalid_span_id";
  }
  if (!isIntegerAtLeast(request.revision, 1)) {
    return "invalid_revision";
  }
  if (!isIntegerAtLeast(request.translation_attempt, 1)) {
    return "invalid_translation_attempt";
  }
  return null;
}

function validateTranslationRequestContent(request: TranslationRequest): string | null {
  if (typeof request.source_caption !== "string" || !request.source_caption.trim()) {
    return "empty_source_caption";
  }
  if (
    typeof request.source_status !== "undefined" &&
    request.source_status !== "stable" &&
    request.source_status !== "final"
  ) {
    return "invalid_source_status";
  }
  const languagePair = parseLanguagePair(request.source_language, request.target_language);
  if ("error" in languagePair) {
    return languagePair.error;
  }
  return null;
}

function validateTranslationRequestOptions(request: TranslationRequest): string | null {
  if (
    "translation_mode" in request &&
    typeof request.translation_mode !== "undefined" &&
    parseTranslationMode(request.translation_mode) !== request.translation_mode
  ) {
    return "invalid_translation_mode";
  }
  if (
    "translation_model_route" in request &&
    typeof request.translation_model_route !== "undefined" &&
    !isTranslationModelRoute(request.translation_model_route)
  ) {
    return "invalid_translation_model_route";
  }
  if (
    typeof request.context_summary !== "undefined" &&
    request.context_summary !== null &&
    (typeof request.context_summary !== "string" || request.context_summary.length > sessionSummaryCharLimit)
  ) {
    return "invalid_context_summary";
  }
  return null;
}

function validateTranslationRequestContext(request: TranslationRequest): string | null {
  if (!Array.isArray(request.context_spans) || request.context_spans.length > 10) {
    return "invalid_context_spans";
  }
  for (const span of request.context_spans) {
    if (!isValidTranslationContextSpan(span)) {
      return "invalid_context_spans";
    }
  }
  return null;
}

function isValidTranslationContextSpan(span: unknown): span is TranslationRequest["context_spans"][number] {
  return (
    typeof span === "object" &&
    span !== null &&
    typeof (span as { span_id?: unknown }).span_id === "string" &&
    typeof (span as { source_caption?: unknown }).source_caption === "string" &&
    "translated_caption" in span &&
    (
      typeof (span as { translated_caption?: unknown }).translated_caption === "string" ||
      (span as { translated_caption?: unknown }).translated_caption === null
    )
  );
}

export function validateTranslationModelRouteForEnv(
  route: TranslationModelRoute | undefined,
  env: EnvWithMode,
): string | null {
  if (!route || route === defaultTranslationModelRoute) {
    return null;
  }
  return env.MURMUR_ENV === "production" ? "dev_translation_model_route_unavailable" : null;
}

export function validateSummaryRequest(request: SummaryRequest | null): string | null {
  if (!request || typeof request !== "object") {
    return "invalid_json";
  }
  if (typeof request.app_session_id !== "string" || request.app_session_id.length < 8) {
    return "invalid_session_id";
  }
  if (
    typeof request.session_epoch !== "number" ||
    !Number.isInteger(request.session_epoch) ||
    request.session_epoch < 1
  ) {
    return "invalid_session_epoch";
  }
  if (
    typeof request.input_memory_version !== "number" ||
    !Number.isInteger(request.input_memory_version) ||
    request.input_memory_version < 1
  ) {
    return "invalid_memory_version";
  }
  if (typeof request.summary_job_id !== "string" || request.summary_job_id.length < 8) {
    return "invalid_summary_job_id";
  }
  const languagePair = parseLanguagePair(request.source_language, request.target_language);
  if ("error" in languagePair) {
    return languagePair.error;
  }
  if (
    !request.previous_summary ||
    typeof request.previous_summary.text !== "string" ||
    request.previous_summary.text.length > sessionSummaryCharLimit
  ) {
    return "invalid_previous_summary";
  }
  if (!Array.isArray(request.spans_to_summarize) || request.spans_to_summarize.length === 0) {
    return "invalid_summary_spans";
  }
  let sourceCharsToSummarize = 0;
  for (const span of request.spans_to_summarize) {
    if (
      !span ||
      typeof span.span_id !== "string" ||
      typeof span.source_caption !== "string" ||
      typeof span.translated_caption !== "string" ||
      typeof span.source_char_count !== "number" ||
      !Number.isInteger(span.source_char_count) ||
      span.source_char_count < 0 ||
      span.source_char_count !== span.source_caption.length
    ) {
      return "invalid_summary_spans";
    }
    sourceCharsToSummarize += span.source_caption.length;
  }
  if (sourceCharsToSummarize > summarySourceCharLimit) {
    return "summary_spans_too_large";
  }
  return null;
}

export function parseLanguagePair(
  sourceLanguage: unknown,
  targetLanguage: unknown,
): { sourceLanguage: SourceLanguageCode; targetLanguage: LanguageCode } | { error: string } {
  if (!isSourceLanguageCode(sourceLanguage)) {
    return { error: "invalid_source_language" };
  }
  if (!isLanguageCode(targetLanguage)) {
    return { error: "invalid_target_language" };
  }
  if (sourceLanguage !== autoSourceLanguageCode && sourceLanguage === targetLanguage) {
    return { error: "same_language_pair" };
  }
  return { sourceLanguage, targetLanguage };
}

export function parseTranslationMode(value: unknown): TranslationMode {
  return value === "continuous" ? "continuous" : "phrase";
}

export function parseTranslationModelRoute(value: unknown): TranslationModelRoute {
  return isTranslationModelRoute(value) ? value : defaultTranslationModelRoute;
}
