import type { NativeScrollEvent } from "react-native";

import type { TranslationSpan } from "@murmur/protocol/session";
import type { UiVariant } from "./types";

const uiVariants = ["aura", "bloom", "classic", "console"] as const;

export function isUiVariant(value: unknown): value is UiVariant {
  return typeof value === "string" && (uiVariants as readonly string[]).includes(value);
}

export type SignalStages = {
  listen: boolean;
  speak: boolean;
  transcribe: boolean;
  translate: boolean;
};

export function deriveSignalStages(params: {
  captureActive: boolean;
  hasTentativeCaption: boolean;
  pendingCount: number;
  playbackActive: boolean;
}): SignalStages {
  return {
    listen: params.captureActive,
    speak: params.playbackActive,
    transcribe: params.captureActive && params.hasTentativeCaption,
    translate: params.pendingCount > 0,
  };
}

export function latestCommittedLatencyMs(spans: TranslationSpan[]): number | null {
  for (let index = spans.length - 1; index >= 0; index -= 1) {
    const span = spans[index];
    if (!span.committed_translated_caption) {
      continue;
    }
    const elapsed = span.updated_at_ms - span.created_at_ms;
    return elapsed >= 0 ? elapsed : null;
  }
  return null;
}

export function formatLatencyMs(latencyMs: number | null): string {
  if (latencyMs === null) {
    return "--";
  }
  if (latencyMs < 1000) {
    return `${Math.round(latencyMs)}ms`;
  }
  return `${(latencyMs / 1000).toFixed(1)}s`;
}

export function formatClockTime(timestampMs: number): string {
  const date = new Date(timestampMs);
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

export function timelineTranslationText(span: TranslationSpan): string {
  return span.committed_translated_caption ||
    span.partial_translated_caption ||
    (span.status === "failed" ? "Translation failed" : "Translating...");
}

export function isPartialSpan(span: TranslationSpan): boolean {
  return Boolean(span.partial_translated_caption && !span.committed_translated_caption) ||
    span.status === "translating";
}

export function shouldHideSpan(span: TranslationSpan): boolean {
  return !span.source_caption.trim() &&
    !span.committed_translated_caption &&
    !span.partial_translated_caption;
}

export function hasVisibleTimeline(spans: TranslationSpan[], tentativeSourceCaption: string): boolean {
  return spans.some((span) => !shouldHideSpan(span)) || Boolean(tentativeSourceCaption.trim());
}

export function normalizedMicLevel(rms: number): number {
  return Math.min(1, Math.max(0, rms * 4));
}

export function shouldKeepAutoScroll(nativeEvent: NativeScrollEvent): boolean {
  return distanceFromBottom(nativeEvent) < 160;
}

function distanceFromBottom(nativeEvent: NativeScrollEvent): number {
  return nativeEvent.contentSize.height -
    nativeEvent.layoutMeasurement.height -
    nativeEvent.contentOffset.y;
}
