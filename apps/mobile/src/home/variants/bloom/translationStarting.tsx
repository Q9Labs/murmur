import { useEffect, type ReactNode } from "react";
import { AccessibilityInfo, Animated, Text, View } from "react-native";

import { uiContentDirectionStyle, uiTextDirectionStyle, useUiLocale } from "../../../i18n/runtime";
import { usePulse, useReducedMotion } from "../hooks";
import { useBloomStyles } from "./styles";

export function TranslationStarting({ slow, phoneAudio = false }: { slow: boolean; phoneAudio?: boolean }): ReactNode {
  const { direction, t } = useUiLocale();
  const { styles } = useBloomStyles();
  const reducedMotion = useReducedMotion();
  const pulse = usePulse(!reducedMotion, reducedMotion, 2400);
  const title = t("home.translationStarting");
  const initialHint = t(phoneAudio ? "home.playAudioCaptions" : "home.translationStartingHint");
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(`${title} ${initialHint}`);
  }, [title, initialHint]);

  return (
    <View style={styles.startingContent}>
      <View style={[styles.startingTitleRow, uiContentDirectionStyle(direction)]}>
        <Animated.View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[styles.startingDot, { opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }]}
        />
        <Text style={[styles.sourceText, styles.startingTitle, uiTextDirectionStyle(direction)]}>{title}</Text>
      </View>
      <Text style={[styles.sourceText, uiTextDirectionStyle(direction)]}>
        {slow ? t("home.translationStartingSlow") : initialHint}
      </Text>
    </View>
  );
}
