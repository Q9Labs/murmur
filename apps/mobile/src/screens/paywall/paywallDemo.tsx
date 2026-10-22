import { getLanguage } from "@murmur/protocol/languages";
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
    if (reducedMotion !== false) {
      return;
    }
    let revealed = 0;
    const interval = setInterval(() => {
      revealed += 1;
      setVisible(revealed);
      if (revealed === words.length) clearInterval(interval);
    }, 2000 / words.length);
    return () => clearInterval(interval);
  }, [conversation.translation, reducedMotion, words.length]);
  const count = reducedMotion ? words.length : visible;
  const committedEnd = Math.max(0, words.length - 4);
  return (
    <View style={styles.demo}>
      <Text accessibilityLabel={conversation.translation} style={[caption.timelineTranslation, styles.caption, uiTextDirectionStyle(getLanguage(conversation.targetLanguage).rtl ? "rtl" : "ltr", ui.direction)]}>
        <Text>{words.slice(0, Math.min(count, committedEnd)).join("")}</Text>
        <Text style={caption.translationPartial}>{words.slice(committedEnd, count).join("")}</Text>
        <Text style={styles.hidden}>{words.slice(count).join("")}</Text>
      </Text>
      <Text style={[caption.sourceText, styles.source, uiTextDirectionStyle(getLanguage(conversation.sourceLanguage).rtl ? "rtl" : "ltr", ui.direction)]}>{conversation.sourceCaption}</Text>
    </View>
  );
}
