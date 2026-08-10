import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";

import type { TranslationSpan } from "@murmur/protocol/session";
import type { ReportTranslationCategory } from "@murmur/protocol/transport/types";

import type { LiveTranslationController } from "../lib/useLiveTranslation";
import { styles } from "./styles";

const reportActions = [
  { category: "inaccurate", label: "Inaccurate" },
  { category: "wrong_language", label: "Wrong language" },
  { category: "offensive_harmful", label: "Harmful" },
  { category: "speech_issue", label: "Speech" },
  { category: "other", label: "Other" },
] as const satisfies readonly {
  category: ReportTranslationCategory;
  label: string;
}[];

export function TranslationReportActions({
  live,
  span,
}: {
  live: LiveTranslationController;
  span: TranslationSpan;
}): ReactNode {
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
          <Text style={styles.reportButtonText}>{action.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}
