import { StyleSheet } from "react-native";

import {
  darkMurmurTheme,
  lightMurmurTheme,
  type MurmurTheme,
  useMurmurTheme,
} from "./theme";

function createSheetStyles(theme: MurmurTheme) {
  return StyleSheet.create({
    languageList: {
      paddingBottom: 28,
      paddingTop: 8,
    },
    languageOption: {
      alignItems: "center",
      borderBottomColor: theme.hairline,
      borderBottomWidth: 1,
      flexDirection: "row",
      gap: 14,
      justifyContent: "space-between",
      minHeight: 68,
      paddingHorizontal: 12,
    },
    languageOptionCheck: {
      color: theme.teal,
      fontSize: 20,
      fontWeight: "900",
      minWidth: 24,
      textAlign: "center",
    },
    languageOptionCopy: {
      flex: 1,
    },
    languageOptionDisabled: {
      opacity: 0.34,
    },
    languageOptionName: {
      color: theme.primary,
      fontSize: 17,
      fontWeight: "800",
    },
    languageOptionNative: {
      color: theme.muted,
      fontSize: 13,
      fontWeight: "600",
      marginTop: 3,
    },
    languageOptionSelected: {
      backgroundColor: theme.selected,
      borderBottomColor: theme.selectedBorder,
      borderRadius: 16,
    },
    modalScrim: {
      backgroundColor: theme.scrim,
      flex: 1,
      justifyContent: "flex-end",
    },
    pressed: {
      opacity: 0.55,
    },
    searchInput: {
      backgroundColor: theme.input,
      borderColor: theme.hairline,
      borderRadius: 16,
      borderWidth: 1,
      color: theme.primary,
      fontSize: 16,
      fontWeight: "600",
      minHeight: 52,
      paddingHorizontal: 16,
    },
    settingsAction: {
      alignItems: "center",
      borderBottomColor: theme.hairline,
      borderBottomWidth: 1,
      flexDirection: "row",
      justifyContent: "space-between",
      minHeight: 62,
      paddingHorizontal: 4,
    },
    settingsActionText: {
      color: theme.primary,
      fontSize: 16,
      fontWeight: "700",
    },
    settingsList: {
      marginTop: 2,
    },
    settingsMessage: {
      color: theme.muted,
      fontSize: 13,
      fontWeight: "600",
      marginTop: 16,
    },
    sheet: {
      backgroundColor: theme.surface,
      borderColor: theme.hairline,
      borderTopLeftRadius: 30,
      borderTopRightRadius: 30,
      borderWidth: 1,
      maxHeight: "88%",
      paddingHorizontal: 20,
      paddingTop: 10,
      shadowColor: "#050306",
      shadowOffset: { height: -8, width: 0 },
      shadowOpacity: theme.dark ? 0.34 : 0.14,
      shadowRadius: 24,
    },
    sheetDismissArea: {
      ...StyleSheet.absoluteFillObject,
    },
    sheetDone: {
      alignItems: "center",
      backgroundColor: theme.input,
      borderRadius: 18,
      height: 36,
      justifyContent: "center",
      width: 36,
    },
    sheetHandle: {
      alignSelf: "center",
      backgroundColor: theme.hairline,
      borderRadius: 999,
      height: 5,
      marginBottom: 12,
      width: 42,
    },
    sheetHeader: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 16,
    },
    sheetKeyboard: {
      flex: 1,
      justifyContent: "flex-end",
    },
    sheetTitle: {
      color: theme.primary,
      fontSize: 26,
      fontWeight: "800",
      letterSpacing: -0.3,
    },
  });
}

const lightStyles = createSheetStyles(lightMurmurTheme);
const darkStyles = createSheetStyles(darkMurmurTheme);

export function useSheetStyles() {
  const colors = useMurmurTheme();
  return { colors, styles: colors.dark ? darkStyles : lightStyles };
}
