import { StyleSheet } from "react-native";

import {
  darkMurmurTheme,
  lightMurmurTheme,
  type MurmurTheme,
  useMurmurTheme,
} from "../../home/theme";

function createAuthStyles(theme: MurmurTheme) {
  return StyleSheet.create({
    body: {
      color: theme.secondaryText,
      fontSize: 16,
      lineHeight: 24,
    },
    centered: {
      textAlign: "center",
    },
    codeInput: {
      fontSize: 28,
      fontWeight: "800",
      letterSpacing: 10,
      minHeight: 64,
      textAlign: "center",
    },
    doneBadge: {
      alignItems: "center",
      alignSelf: "center",
      backgroundColor: theme.selected,
      borderColor: theme.selectedBorder,
      borderRadius: 999,
      borderWidth: 1,
      height: 64,
      justifyContent: "center",
      width: 64,
    },
    emphasis: {
      color: theme.primary,
      fontWeight: "800",
    },
    error: {
      color: theme.danger,
      fontSize: 14,
      fontWeight: "700",
      lineHeight: 20,
    },
    flow: {
      gap: 16,
    },
    input: {
      backgroundColor: theme.input,
      borderColor: theme.hairline,
      borderRadius: 16,
      borderWidth: 1,
      color: theme.primary,
      fontSize: 17,
      fontWeight: "600",
      minHeight: 54,
      paddingHorizontal: 16,
    },
    inputError: {
      borderColor: theme.danger,
      borderWidth: 1.5,
    },
    linkRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 18,
      justifyContent: "center",
    },
    linkText: {
      color: theme.primary,
      fontSize: 15,
      fontWeight: "800",
      textDecorationLine: "underline",
    },
    notice: {
      color: theme.secondaryText,
      fontSize: 14,
      fontWeight: "700",
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
    primaryButtonPending: {
      backgroundColor: theme.muted,
    },
    primaryButtonText: {
      color: theme.onAction,
      fontSize: 17,
      fontWeight: "800",
    },
  });
}

export type AuthStyles = ReturnType<typeof createAuthStyles>;

const lightStyles = createAuthStyles(lightMurmurTheme);
const darkStyles = createAuthStyles(darkMurmurTheme);

export function useAuthStyles(): { colors: MurmurTheme; styles: AuthStyles } {
  const colors = useMurmurTheme();
  return { colors, styles: colors.dark ? darkStyles : lightStyles };
}
