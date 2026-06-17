import type { TranslationSpan } from "../session";
import type { TranslationRequest } from "../transport/types";

export function normalizeCaption(caption: string): string {
  return caption.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

export function joinSourceCaptions(prefix: string | null, caption: string): string {
  return [prefix, caption]
    .map((item) => item?.trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

export function spanKey(spanId: string, revision: number): string {
  return `${spanId}:${revision}`;
}

export function withRetryClientRequestId(request: TranslationRequest): TranslationRequest {
  return {
    ...request,
    client_request_id: createTranslationClientRequestId(
      request.span_id,
      request.revision,
      request.translation_attempt,
    ),
  };
}

export function resetSpanForContinuousRetry(
  span: TranslationSpan,
  request: TranslationRequest,
): TranslationSpan {
  return {
    ...span,
    partial_translated_caption: null,
    status: "translating",
    translated_caption: span.committed_translated_caption ?? "",
    translation_attempt: request.translation_attempt,
    translation_client_request_id: request.client_request_id ?? null,
    translation_request_id: null,
    updated_at_ms: Date.now(),
  };
}

export function createTranslationClientRequestId(
  spanId: string,
  revision: number,
  attempt: number,
): string {
  return `ctr_${spanId}_${revision}_${attempt}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createSummaryJobId(): string {
  return `summary_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}
