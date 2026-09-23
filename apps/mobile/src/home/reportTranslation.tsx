import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";

import type { TranslationSpan } from "@murmur/protocol/session";
import type { ReportTranslationCategory } from "@murmur/protocol/transport/types";

import { uiTextDirectionStyle, useUiLocale } from "../i18n/runtime";
import type { LiveTranslationController } from "../lib/useLiveTranslation";
import { styles } from "./styles";

const reportActions = [
  { category: "inaccurate", labelKey: "report.inaccurate" },
  { category: "wrong_language", labelKey: "report.wrongLanguage" },
  { category: "offensive_harmful", labelKey: "report.harmful" },
  { category: "speech_issue", labelKey: "report.speech" },
  { category: "other", labelKey: "report.other" },
] as const satisfies readonly {
  category: ReportTranslationCategory;
  labelKey: "report.inaccurate" | "report.wrongLanguage" | "report.harmful" | "report.speech" | "report.other";
}[];

export function TranslationReportActions({
  live,
  span,
}: {
  live: LiveTranslationController;
  span: TranslationSpan;
}): ReactNode {
  const { direction, t } = useUiLocale();
  if (span.status !== "committed") {
    return null;
  }
  return (
    <View style={styles.reportRow}>
      {reportActions.map((action) => (
        <Pressable
          accessibilityRole="button"
          key={action.category}
          onPress={() => void live.reportSpan(span, action.category)}
          style={styles.reportButton}
        >
          <Text style={[styles.reportButtonText, uiTextDirectionStyle(direction)]}>
            {t(action.labelKey)}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
