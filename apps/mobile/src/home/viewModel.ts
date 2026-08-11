import {
  autoSourceLanguageCode,
  getLanguage,
  type LanguageCode,
  type LanguageDefinition,
  type SourceLanguageCode,
} from "@murmur/protocol/languages";
import { canStartSession, type TranslationSpan } from "@murmur/protocol/session";
import type { LiveTranslationController } from "../lib/useLiveTranslation";
import { getLatestProviderRoute } from "./providerRoute";
import {
  getHealthText,
  getStatusText,
} from "./statusLabels";

export type HomeViewModel = {
  canChangeLanguages: boolean;
  canStart: boolean;
  canSwapLanguages: boolean;
  pendingCount: number;
  hasSourceText: boolean;
  hasTranslatedText: boolean;
  healthText: string;
  isLive: boolean;
  latestProviderRoute: string;
  latestSourceCaption: string;
  latestTranslationIsPartial: boolean;
  latestTranslationText: string;
  primaryCanvasText: string;
  secondaryCanvasText: string;
  sourceLanguage: LanguageDefinition | null;
  sourceLanguageDisplayName: string;
  statusText: string;
  targetLanguage: LanguageDefinition;
};

export function buildHomeViewModel(params: {
  live: Pick<
    LiveTranslationController,
    "error" | "preparation_status" | "spans" | "status" | "tentative_source_caption"
  >;
  sourceLanguageCode: SourceLanguageCode;
  targetLanguageCode: LanguageCode;
}): HomeViewModel {
  const sourceLanguage = getSourceLanguage(params.sourceLanguageCode);
  const targetLanguage = getLanguage(params.targetLanguageCode);
  const latestTranslation = findLatestTranslation(params.live.spans);
  const latestTranslationText = getLatestTranslationText(latestTranslation);
  const latestSourceCaption = getLatestSourceCaption(params.live);
  const canChangeLanguages = canStartSession(params.live.status);
  const isLive = params.live.status === "live";
  const hasTranslatedText = Boolean(latestTranslationText.trim());
  const hasSourceText = Boolean(latestSourceCaption.trim());

  return {
    canChangeLanguages,
    canStart: canStartTranslation({
      canChangeLanguages,
      sourceLanguageCode: params.sourceLanguageCode,
      targetLanguageCode: params.targetLanguageCode,
    }),
    canSwapLanguages: canChangeLanguages && params.sourceLanguageCode !== autoSourceLanguageCode,
    pendingCount: countPendingSpans(params.live.spans),
    hasSourceText,
    hasTranslatedText,
    healthText: getHealthText(params.live.status, params.live.error),
    isLive,
    latestProviderRoute: getLatestProviderRoute(params.live.spans) ?? "openai:gpt-realtime-translate",
    latestSourceCaption,
    latestTranslationIsPartial: isPartialTranslation(latestTranslation),
    latestTranslationText,
    primaryCanvasText: buildPrimaryCanvasText({
      error: params.live.error,
      hasTranslatedText,
      isLive,
      latestTranslationText,
    }),
    secondaryCanvasText: buildSecondaryCanvasText({
      error: params.live.error,
      hasSourceText,
      isLive,
      latestSourceCaption,
    }),
    sourceLanguage,
    sourceLanguageDisplayName: sourceLanguage?.display_name ?? "Auto detect",
    statusText: getStatusText(
      params.live.status,
      params.live.error,
      params.live.preparation_status,
    ),
    targetLanguage,
  };
}

function getSourceLanguage(sourceLanguageCode: SourceLanguageCode): LanguageDefinition | null {
  return sourceLanguageCode === autoSourceLanguageCode ? null : getLanguage(sourceLanguageCode);
}

function findLatestTranslation(spans: TranslationSpan[]): TranslationSpan | undefined {
  return [...spans]
    .reverse()
    .find((span) => span.committed_translated_caption?.trim() || span.partial_translated_caption?.trim());
}

function getLatestTranslationText(span: TranslationSpan | undefined): string {
  return span?.committed_translated_caption ||
    span?.partial_translated_caption ||
    span?.translated_caption ||
    "";
}

function getLatestSourceCaption(params: Pick<LiveTranslationController, "spans" | "tentative_source_caption">): string {
  return params.tentative_source_caption ||
    params.spans[params.spans.length - 1]?.source_caption ||
    "";
}

function canStartTranslation(params: {
  canChangeLanguages: boolean;
  sourceLanguageCode: SourceLanguageCode;
  targetLanguageCode: LanguageCode;
}): boolean {
  return params.canChangeLanguages &&
    (params.sourceLanguageCode === autoSourceLanguageCode ||
      params.sourceLanguageCode !== params.targetLanguageCode);
}

function countPendingSpans(spans: TranslationSpan[]): number {
  return spans.filter(isPendingSpan).length;
}

function isPendingSpan(span: TranslationSpan): boolean {
  return span.status === "translating" ||
    Boolean(span.partial_translated_caption && !span.committed_translated_caption);
}

function isPartialTranslation(span: TranslationSpan | undefined): boolean {
  return Boolean(span?.partial_translated_caption) && !span?.committed_translated_caption;
}

function buildPrimaryCanvasText(params: {
  error: string | null;
  hasTranslatedText: boolean;
  isLive: boolean;
  latestTranslationText: string;
}): string {
  if (params.hasTranslatedText) {
    return params.latestTranslationText;
  }
  if (params.isLive) {
    return "Listening";
  }
  if (params.error === "microphone_permission_denied") {
    return "Microphone access needed";
  }
  return "Ready to translate";
}

function buildSecondaryCanvasText(params: {
  error: string | null;
  hasSourceText: boolean;
  isLive: boolean;
  latestSourceCaption: string;
}): string {
  if (params.hasSourceText) {
    return params.latestSourceCaption;
  }
  if (params.isLive) {
    return "Speak now. Captions will appear here.";
  }
  if (params.error === "microphone_permission_denied") {
    return "Allow microphone access to start listening.";
  }
  return "Choose a direction, then tap Listen.";
}
