import { StyleSheet } from "react-native";

import {
  darkMurmurTheme,
  lightMurmurTheme,
  type MurmurTheme,
  useMurmurTheme,
} from "../../theme";

function createBloomStyles(theme: MurmurTheme) {
  return StyleSheet.create({
    checkbox: {
      alignItems: "center",
      borderColor: theme.muted,
      borderRadius: 8,
      borderWidth: 1.5,
      height: 26,
      justifyContent: "center",
      width: 26,
    },
    checkboxChecked: {
      backgroundColor: theme.teal,
      borderColor: theme.teal,
    },
    checkboxMark: {
      color: theme.onPrimary,
      fontSize: 15,
      fontWeight: "700",
    },
    chrome: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between",
      paddingHorizontal: 20,
      paddingTop: 10,
    },
    chromeActions: {
      alignItems: "center",
      flexDirection: "row",
      gap: 8,
    },
    chromeButton: {
      alignItems: "center",
      backgroundColor: theme.chromeButton,
      borderColor: theme.hairline,
      borderRadius: 999,
      borderWidth: 1,
      height: 42,
      justifyContent: "center",
      width: 42,
    },
    chromeButtonActive: {
      backgroundColor: theme.selected,
      borderColor: theme.selectedBorder,
    },
    consentRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: 14,
      paddingVertical: 16,
    },
    controlColumn: {
      alignItems: "stretch",
      gap: 14,
      paddingBottom: 20,
      paddingHorizontal: 20,
      paddingTop: 12,
    },
    copy: {
      color: theme.muted,
      fontSize: 16,
      lineHeight: 25,
    },
    error: {
      color: theme.coral,
      fontSize: 14,
      lineHeight: 20,
      paddingHorizontal: 24,
      textAlign: "center",
    },
    eyebrow: {
      color: theme.teal,
      fontSize: 14,
      fontWeight: "700",
      letterSpacing: 0.4,
    },
    flexFill: {
      flex: 1,
    },
    languageRow: {
      alignItems: "center",
      alignSelf: "center",
      flexDirection: "row",
      gap: 14,
      minHeight: 28,
    },
    languageText: {
      color: theme.primary,
      fontSize: 15,
      fontWeight: "700",
    },
    listenPill: {
      alignItems: "center",
      backgroundColor: theme.action,
      borderRadius: 999,
      justifyContent: "center",
      minHeight: 56,
      paddingHorizontal: 24,
      width: "100%",
    },
    listenPillText: {
      color: theme.onAction,
      fontSize: 17,
      fontWeight: "800",
    },
    modeTab: {
      color: theme.muted,
      fontSize: 15,
      fontWeight: "600",
    },
    modeTabActive: {
      color: theme.primary,
      fontSize: 15,
      fontWeight: "800",
    },
    modeTabs: {
      alignItems: "center",
      flexDirection: "row",
      gap: 18,
    },
    onboardingBody: {
      flex: 1,
      gap: 18,
      justifyContent: "center",
      paddingHorizontal: 32,
    },
    onboardingFooter: {
      alignItems: "stretch",
      paddingBottom: 26,
      paddingHorizontal: 28,
      paddingTop: 10,
    },
    pressed: {
      opacity: 0.55,
    },
    progressDot: {
      backgroundColor: theme.hairline,
      borderRadius: 999,
      height: 5,
      width: 5,
    },
    progressDotActive: {
      backgroundColor: theme.primary,
      width: 20,
    },
    progressRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: 6,
      justifyContent: "center",
      paddingTop: 14,
    },
    receipt: {
      color: theme.teal,
      fontSize: 14,
      paddingHorizontal: 24,
      textAlign: "center",
    },
    rtlText: {
      textAlign: "right",
      writingDirection: "rtl",
    },
    screen: {
      backgroundColor: theme.background,
      flex: 1,
    },
    setupRow: {
      borderBottomColor: theme.hairline,
      borderBottomWidth: 1.5,
      gap: 6,
      paddingVertical: 18,
    },
    setupValue: {
      color: theme.primary,
      fontSize: 24,
      fontWeight: "700",
    },
    sourceText: {
      color: theme.muted,
      fontSize: 15,
      lineHeight: 23,
    },
    swapText: {
      color: theme.teal,
      fontSize: 18,
      fontWeight: "700",
    },
    timelineContent: {
      flexGrow: 1,
      gap: 20,
      paddingBottom: 32,
      paddingHorizontal: 30,
      paddingTop: 52,
    },
    timelineTranslation: {
      color: theme.primary,
      fontSize: 32,
      fontWeight: "800",
      lineHeight: 42,
    },
    title: {
      color: theme.primary,
      fontSize: 36,
      fontWeight: "800",
      lineHeight: 44,
    },
    translationPartial: {
      opacity: 0.5,
    },
    wordmark: {
      color: theme.primary,
      fontSize: 18,
      fontWeight: "800",
      letterSpacing: 0.2,
    },
    brandMark: {
      alignItems: "center",
      flexDirection: "row",
      gap: 8,
    },
    brandLogo: {
      borderRadius: 10,
      height: 30,
      width: 30,
    },
    heroAccent: {
      borderRadius: 999,
      height: 5,
    },
    heroAccentCoral: {
      backgroundColor: theme.coral,
      width: 12,
    },
    heroAccentGold: {
      backgroundColor: theme.gold,
      width: 20,
    },
    heroAccentRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: 5,
      justifyContent: "center",
      marginTop: 12,
    },
    heroAccentTeal: {
      backgroundColor: theme.teal,
      width: 28,
    },
    heroAccentViolet: {
      backgroundColor: theme.violet,
      width: 12,
    },
    heroFrame: {
      alignItems: "center",
      backgroundColor: theme.surface,
      borderColor: theme.hairline,
      borderRadius: 42,
      borderWidth: 1,
      justifyContent: "center",
      padding: 10,
    },
    heroLogo: {
      borderRadius: 32,
      height: 172,
      width: 172,
    },
    heroWrap: {
      alignItems: "center",
      justifyContent: "center",
      minHeight: 224,
    },
  });
}

const lightStyles = createBloomStyles(lightMurmurTheme);
const darkStyles = createBloomStyles(darkMurmurTheme);

export function useBloomStyles() {
  const colors = useMurmurTheme();
  return { colors, styles: colors.dark ? darkStyles : lightStyles };
}
