import {
  autoSourceLanguageCode,
  isLanguageCode,
  isSourceLanguageCode,
  type LanguageCode,
  type SourceLanguageCode,
} from "@murmur/protocol/languages";

export type ReportCategory =
  | "inaccurate"
  | "offensive_harmful"
  | "wrong_language"
  | "speech_issue"
  | "other";

export type TranslationReportRequest = {
  app_session_id: string;
  error_category: ReportCategory;
  optional_source_text_snapshot?: string;
  optional_translated_text_snapshot?: string;
  optional_user_note?: string;
  provider_metadata?: Record<string, unknown>;
  revision: number;
  source_language: SourceLanguageCode;
  span_id: string;
  target_language: LanguageCode;
};

export type TranslationReportReceipt = {
  created_at_ms: number;
  report_id: string;
  retained_text_snapshot: boolean;
};

const reportCategories = new Set<ReportCategory>([
  "inaccurate",
  "offensive_harmful",
  "wrong_language",
  "speech_issue",
  "other",
]);

export function parseTranslationReport(
  payload: unknown,
): TranslationReportRequest | { error: string } {
  if (!isRecord(payload)) {
    return { error: "invalid_report" };
  }

  const category = payload.error_category;
  if (typeof category !== "string" || !reportCategories.has(category as ReportCategory)) {
    return { error: "invalid_report_category" };
  }

  const requiredStrings = ["app_session_id", "span_id"] as const;
  for (const key of requiredStrings) {
    if (typeof payload[key] !== "string" || !payload[key]) {
      return { error: `invalid_${key}` };
    }
  }

  if (!isSourceLanguageCode(payload.source_language)) {
    return { error: "invalid_source_language" };
  }
  if (!isLanguageCode(payload.target_language)) {
    return { error: "invalid_target_language" };
  }
  if (payload.source_language !== autoSourceLanguageCode && payload.source_language === payload.target_language) {
    return { error: "same_language_pair" };
  }

  if (
    typeof payload.revision !== "number" ||
    !Number.isInteger(payload.revision) ||
    payload.revision < 1
  ) {
    return { error: "invalid_revision" };
  }

  return {
    app_session_id: String(payload.app_session_id),
    error_category: category as ReportCategory,
    optional_source_text_snapshot: optionalString(payload.optional_source_text_snapshot, 1200),
    optional_translated_text_snapshot: optionalString(payload.optional_translated_text_snapshot, 1200),
    optional_user_note: optionalString(payload.optional_user_note, 1000),
    provider_metadata: isRecord(payload.provider_metadata) ? payload.provider_metadata : undefined,
    revision: payload.revision,
    source_language: payload.source_language,
    span_id: String(payload.span_id),
    target_language: payload.target_language,
  };
}

export async function forwardReport(params: {
  report: TranslationReportRequest;
  reportWebhookUrl?: string;
  receipt: TranslationReportReceipt;
}): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (!params.reportWebhookUrl) {
    return { ok: true };
  }

  const response = await fetch(params.reportWebhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...params.report,
      ...params.receipt,
    }),
  }).catch(() => null);
  if (!response) {
    return { ok: false, reason: "webhook_network_error" };
  }
  if (!response.ok) {
    return { ok: false, reason: `webhook_http_${response.status}` };
  }
  return { ok: true };
}

function optionalString(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  return trimmed.slice(0, maxLength);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
