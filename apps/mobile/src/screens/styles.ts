import { StyleSheet } from "react-native";

import {
  darkMurmurTheme,
  lightMurmurTheme,
  type MurmurTheme,
  useMurmurTheme,
} from "../home/theme";

function createScreenStyles(theme: MurmurTheme) {
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
    content: {
      gap: 24,
      paddingBottom: 40,
      paddingHorizontal: 20,
      paddingTop: 8,
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
      color: theme.secondaryText,
      fontSize: 15,
      fontWeight: "600",
      lineHeight: 22,
    },
    messageError: {
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
    screen: {
      backgroundColor: theme.background,
      flex: 1,
    },
    title: {
      color: theme.primary,
      fontSize: 34,
      fontWeight: "800",
      letterSpacing: -0.4,
    },
  });
}

export type ScreenStyles = ReturnType<typeof createScreenStyles>;

const lightStyles = createScreenStyles(lightMurmurTheme);
const darkStyles = createScreenStyles(darkMurmurTheme);

export function useScreenStyles(): { colors: MurmurTheme; styles: ScreenStyles } {
  const colors = useMurmurTheme();
  return { colors, styles: colors.dark ? darkStyles : lightStyles };
}
