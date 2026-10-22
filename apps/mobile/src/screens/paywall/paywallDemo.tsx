import { useEffect, useState, type ReactNode } from "react";
import { Text, View } from "react-native";

import { previewConversationFor } from "../../home/previewConversation";
import { useReducedMotion } from "../../home/variants/hooks";
import { useBloomStyles } from "../../home/variants/bloom/styles";
import { uiTextDirectionStyle, useUiLocale } from "../../i18n/runtime";
import { usePaywallStyles } from "./styles";

export function PaywallDemo(): ReactNode {
  const ui = useUiLocale();
  const { styles } = usePaywallStyles();
  const { styles: caption } = useBloomStyles();
  const conversation = previewConversationFor(ui.locale);
  const reducedMotion = useReducedMotion();
  const words = conversation.targetLanguage === "ja"
    ? Array.from(conversation.translation)
    : conversation.translation.match(/\S+\s*/gu) ?? [];
  const [visible, setVisible] = useState(0);
  useEffect(() => {
    setVisible(0);
    if (reducedMotion) {
      return;
    }
    const interval = setInterval(() => setVisible((count) => {
      if (count >= words.length) {
        clearInterval(interval);
      }
      return Math.min(count + 1, words.length);
    }), 2000 / words.length);
    return () => clearInterval(interval);
  }, [conversation.translation, reducedMotion, words.length]);
  const count = reducedMotion ? words.length : visible;
  const committedEnd = Math.max(0, words.length - 4);
  return (
    <View style={styles.demo}>
      <View style={styles.example}>
        <View style={styles.dot} />
        <Text style={styles.exampleText}>{ui.t("paywall.example")}</Text>
      </View>
      <Text accessibilityLabel={conversation.translation} style={[caption.timelineTranslation, styles.caption, uiTextDirectionStyle(conversation.targetLanguage === "ar" ? "rtl" : "ltr", ui.direction)]}>
        <Text>{words.slice(0, Math.min(count, committedEnd)).join("")}</Text>
        <Text style={caption.translationPartial}>{words.slice(committedEnd, count).join("")}</Text>
        <Text style={styles.hidden}>{words.slice(count).join("")}</Text>
      </Text>
      <Text style={[caption.sourceText, styles.source, uiTextDirectionStyle(conversation.sourceLanguage === "ar" ? "rtl" : "ltr", ui.direction)]}>{conversation.sourceCaption}</Text>
    </View>
  );
}
