import type { ReactNode } from "react";
import { Text, View } from "react-native";

import type { TranslationSpan } from "@murmur/protocol/session";
import { styles } from "./styles";

export function ContinuousTimelineRow({
  sourceLanguageRtl,
  span,
  targetLanguageRtl,
}: {
  sourceLanguageRtl: boolean;
  span: TranslationSpan;
  targetLanguageRtl: boolean;
}): ReactNode {
  if (shouldHideSpan(span)) {
    return null;
  }

  return (
    <View style={styles.spanRow}>
      <Text
        style={getTimelineTranslationStyle({
          partial: isPartialTranslation(span),
          targetLanguageRtl,
        })}
      >
        {getTimelineTranslationText(span)}
      </Text>
      <Text style={[styles.spanSource, sourceLanguageRtl && styles.rtlText]}>
        {span.source_caption}
      </Text>
    </View>
  );
}

function shouldHideSpan(span: TranslationSpan): boolean {
  return span.status === "superseded" &&
    !span.committed_translated_caption &&
    !span.partial_translated_caption;
}

function getTimelineTranslationText(span: TranslationSpan): string {
  const caption = [
    span.committed_translated_caption,
    span.partial_translated_caption,
  ].find((value): value is string => Boolean(value));
  return caption ?? getTimelineFallbackText(span);
}

function getTimelineFallbackText(span: TranslationSpan): string {
  return span.status === "failed" ? "Translation failed" : "Translating...";
}

function isPartialTranslation(span: TranslationSpan): boolean {
  return Boolean(span.partial_translated_caption && !span.committed_translated_caption) ||
    span.status === "translating";
}

function getTimelineTranslationStyle(params: {
  partial: boolean;
  targetLanguageRtl: boolean;
}) {
  return [
    styles.spanTranslation,
    params.partial && styles.translatedTextPartial,
    params.targetLanguageRtl && styles.rtlText,
  ];
}
