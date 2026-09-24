import { StyleSheet } from "react-native";

import {
  darkMurmurTheme,
  lightMurmurTheme,
  type MurmurTheme,
  useMurmurTheme,
} from "../home/theme";
import { uiTextDirectionStyle, useUiLocale } from "../i18n/runtime";
import type { UiDirection } from "../i18n/types";

function createScreenStyles(theme: MurmurTheme, direction: UiDirection) {
  // Block text follows the reading direction; centred button labels keep their own alignment.
  const text = uiTextDirectionStyle(direction);
  return StyleSheet.create({
    backButton: {
      alignItems: "center",
      backgroundColor: theme.chromeButton,
      borderColor: theme.hairline,
      borderRadius: 999,
      borderWidth: 1,
      height: 42,
      justifyContent: "center",
      width: 42,
    },
    body: {
      ...text,
      color: theme.secondaryText,
      fontSize: 17,
      fontWeight: "500",
      lineHeight: 25,
    },
    bodyStrong: {
      ...text,
      color: theme.primary,
      fontSize: 20,
      fontWeight: "800",
    },
    choice: {
      flex: 1,
    },
    choiceRow: {
      flexDirection: "row",
      gap: 12,
    },
    content: {
      gap: 24,
      paddingBottom: 40,
      paddingHorizontal: 20,
      paddingTop: 8,
    },
    conversationExcerpt: {
      ...text,
      color: theme.primary,
      fontSize: 17,
      fontWeight: "700",
      lineHeight: 24,
    },
    conversationMeta: {
      ...text,
      color: theme.secondaryText,
      fontSize: 15,
      fontWeight: "600",
      lineHeight: 21,
    },
    conversationRow: {
      gap: 4,
      minHeight: 58,
      paddingHorizontal: 18,
      paddingVertical: 14,
    },
    conversationText: {
      ...text,
      color: theme.primary,
      fontSize: 20,
      fontWeight: "600",
      lineHeight: 30,
    },
    danger: {
      color: theme.danger,
    },
    footer: {
      gap: 10,
      paddingBottom: 12,
      paddingHorizontal: 20,
      paddingTop: 12,
    },
    illustration: {
      alignSelf: "center",
      height: 168,
      width: 240,
    },
    // The first line under the hero reads as its subtitle, so it sits closer than the section gap.
    hero: {
      alignItems: "center",
      gap: 4,
      marginBottom: -12,
    },
    // Illustrations carry a wide transparent margin; the negative margin keeps the artwork
    // large without that margin pushing the title away. Sizing from the width keeps it inside
    // compact phones.
    heroArtwork: {
      aspectRatio: 240 / 168,
      marginVertical: -24,
      maxWidth: 400,
      width: "100%",
    },
    heroLead: {
      color: theme.secondaryText,
      fontSize: 17,
      fontWeight: "500",
      lineHeight: 25,
      textAlign: "center",
    },
    heroTitle: {
      color: theme.primary,
      fontSize: 32,
      fontWeight: "800",
      letterSpacing: -0.4,
      textAlign: "center",
    },
    giftCard: {
      backgroundColor: theme.surface,
      borderColor: theme.hairline,
      borderRadius: 28,
      borderWidth: 1,
      gap: 16,
      padding: 22,
    },
    group: {
      backgroundColor: theme.surface,
      borderColor: theme.hairline,
      borderRadius: 22,
      borderWidth: 1,
      overflow: "hidden",
    },
    header: {
      gap: 18,
      paddingBottom: 12,
      paddingHorizontal: 20,
      paddingTop: 10,
    },
    message: {
      ...text,
      color: theme.secondaryText,
      fontSize: 15,
      fontWeight: "600",
      lineHeight: 22,
    },
    messageError: {
      ...text,
      color: theme.danger,
      fontSize: 15,
      fontWeight: "700",
      lineHeight: 22,
    },
    pressed: {
      opacity: 0.55,
    },
    primaryButton: {
      alignItems: "center",
      backgroundColor: theme.action,
      borderRadius: 999,
      justifyContent: "center",
      minHeight: 56,
      paddingHorizontal: 24,
    },
    primaryButtonText: {
      color: theme.onAction,
      fontSize: 17,
      fontWeight: "800",
    },
    point: {
      alignItems: "flex-start",
      flexDirection: "row",
      gap: 14,
    },
    pointIcon: {
      alignItems: "center",
      backgroundColor: theme.input,
      borderRadius: 999,
      height: 38,
      justifyContent: "center",
      width: 38,
    },
    pointText: {
      ...text,
      color: theme.secondaryText,
      flex: 1,
      fontSize: 16,
      fontWeight: "500",
      lineHeight: 23,
      paddingTop: 7,
    },
    points: {
      gap: 16,
    },
    quietButton: {
      alignItems: "center",
      justifyContent: "center",
      minHeight: 56,
      paddingHorizontal: 20,
    },
    quietButtonText: {
      color: theme.primary,
      fontSize: 16,
      fontWeight: "700",
    },
    row: {
      alignItems: "center",
      flexDirection: "row",
      gap: 12,
      minHeight: 58,
      paddingHorizontal: 18,
      paddingVertical: 12,
    },
    rowDisabled: {
      opacity: 0.5,
    },
    rowDivider: {
      borderTopColor: theme.hairline,
      borderTopWidth: 1,
    },
    rowLabel: {
      ...text,
      color: theme.primary,
      flex: 1,
      fontSize: 17,
      fontWeight: "700",
    },
    rowValue: {
      color: theme.secondaryText,
      fontSize: 16,
      fontWeight: "600",
    },
    secondaryButton: {
      alignItems: "center",
      backgroundColor: theme.surface,
      borderColor: theme.hairline,
      borderRadius: 999,
      borderWidth: 1,
      justifyContent: "center",
      minHeight: 56,
      paddingHorizontal: 24,
    },
    secondaryButtonText: {
      color: theme.primary,
      fontSize: 17,
      fontWeight: "800",
    },
    screen: {
      backgroundColor: theme.background,
      flex: 1,
    },
    title: {
      ...text,
      color: theme.primary,
      fontSize: 34,
      fontWeight: "800",
      letterSpacing: -0.4,
    },
  });
}

export type ScreenStyles = ReturnType<typeof createScreenStyles>;

const screenStyles = {
  ltr: { dark: createScreenStyles(darkMurmurTheme, "ltr"), light: createScreenStyles(lightMurmurTheme, "ltr") },
  rtl: { dark: createScreenStyles(darkMurmurTheme, "rtl"), light: createScreenStyles(lightMurmurTheme, "rtl") },
} as const;

export function useScreenStyles(): { colors: MurmurTheme; styles: ScreenStyles } {
  const colors = useMurmurTheme();
  const { direction } = useUiLocale();
  return { colors, styles: screenStyles[direction][colors.dark ? "dark" : "light"] };
}
