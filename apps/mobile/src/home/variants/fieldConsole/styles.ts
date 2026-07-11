import { Platform, StyleSheet } from "react-native";

const monoFont = Platform.select({ default: "monospace", ios: "Menlo" });

export type ConsolePalette = {
  chassis: string;
  hairline: string;
  ink: string;
  muted: string;
  panel: string;
};

export const consolePalettes: Record<"dark" | "light", ConsolePalette> = {
  dark: {
    chassis: "#17150F",
    hairline: "#3A362C",
    ink: "#EDE7DA",
    muted: "#A79E8C",
    panel: "#23201A",
  },
  light: {
    chassis: "#ECE8DF",
    hairline: "#D8D2C2",
    ink: "#23211C",
    muted: "#6E6758",
    panel: "#F7F4EC",
  },
};

export const consoleAccents = {
  caution: "#D99A1E",
  record: "#E4523F",
  signal: "#1FA48F",
  trace: "#8F7BE0",
} as const;

export const styles = StyleSheet.create({
  chainLabel: {
    fontFamily: monoFont,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
  },
  chainRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    paddingBottom: 14,
    paddingTop: 10,
  },
  chainStage: {
    alignItems: "center",
    flexDirection: "row",
    gap: 5,
  },
  checkBox: {
    alignItems: "center",
    borderRadius: 6,
    borderWidth: 1.5,
    height: 24,
    justifyContent: "center",
    width: 24,
  },
  checkMark: {
    fontSize: 13,
    fontWeight: "800",
  },
  checkRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    paddingVertical: 12,
  },
  error: {
    fontFamily: monoFont,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19,
    textAlign: "center",
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingTop: 8,
  },
  headerCluster: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  headerStat: {
    fontFamily: monoFont,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
  },
  kicker: {
    fontFamily: monoFont,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  light: {
    borderRadius: 999,
    height: 8,
    width: 8,
  },
  listenKey: {
    alignItems: "center",
    backgroundColor: consoleAccents.record,
    borderRadius: 14,
    justifyContent: "center",
    minHeight: 58,
  },
  listenKeyText: {
    color: "#FFF6EC",
    fontFamily: monoFont,
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 2,
  },
  logRow: {
    gap: 4,
    paddingVertical: 10,
  },
  logSource: {
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
  },
  logStamp: {
    fontFamily: monoFont,
    fontSize: 11,
    fontWeight: "700",
  },
  logTranslation: {
    fontSize: 17,
    fontWeight: "700",
    lineHeight: 24,
  },
  main: {
    flex: 1,
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  modeKey: {
    alignItems: "center",
    borderRadius: 8,
    flex: 1,
    minHeight: 38,
    justifyContent: "center",
  },
  modeKeyText: {
    fontFamily: monoFont,
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  modeRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
  modeSwitch: {
    borderRadius: 10,
    borderWidth: 1,
    flex: 1,
    flexDirection: "row",
    padding: 3,
  },
  onboardingBody: {
    flexGrow: 1,
    gap: 14,
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  onboardingCopy: {
    fontSize: 15,
    lineHeight: 22,
  },
  onboardingFooter: {
    paddingBottom: 24,
    paddingHorizontal: 18,
    paddingTop: 10,
  },
  onboardingTitle: {
    fontSize: 26,
    fontWeight: "800",
    lineHeight: 34,
  },
  panel: {
    borderRadius: 14,
    borderWidth: 1,
    gap: 10,
    padding: 14,
  },
  pressed: {
    opacity: 0.55,
  },
  readoutPanel: {
    borderRadius: 14,
    borderWidth: 1,
    flex: 1,
    padding: 16,
  },
  readoutPhrase: {
    flexGrow: 1,
    gap: 14,
    justifyContent: "center",
  },
  readoutSource: {
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 22,
  },
  readoutTranslation: {
    fontSize: 30,
    fontWeight: "700",
    lineHeight: 39,
  },
  routeKey: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    flexShrink: 1,
    minHeight: 38,
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  routeKeyText: {
    fontFamily: monoFont,
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 1,
  },
  routeRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  rtlText: {
    textAlign: "right",
    writingDirection: "rtl",
  },
  screen: {
    flex: 1,
  },
  setupKey: {
    borderRadius: 10,
    borderWidth: 1,
    gap: 4,
    padding: 14,
  },
  translationPartial: {
    opacity: 0.55,
  },
  vuRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  vuSegment: {
    borderRadius: 3,
    flex: 1,
    height: 14,
  },
  vuSegments: {
    flex: 1,
    flexDirection: "row",
    gap: 3,
  },
  wordmark: {
    fontFamily: monoFont,
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 3,
  },
});
