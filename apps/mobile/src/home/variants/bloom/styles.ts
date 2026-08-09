import { StyleSheet } from "react-native";

const bloomColors = {
  coral: "#F0655A",
  cream: "#FAF3E7",
  gold: "#F7B92B",
  hairline: "rgba(58, 46, 63, 0.12)",
  plum: "#3A2E3F",
  soft: "#8D8494",
  teal: "#2FB9A5",
  violet: "#8662E6",
} as const;

export const styles = StyleSheet.create({
  bloomBand: {
    borderRadius: 999,
    height: 14,
    position: "absolute",
  },
  bloomBandCoral: {
    backgroundColor: bloomColors.coral,
    top: 10,
    transform: [{ rotate: "-7deg" }],
    width: 78,
  },
  bloomBandGold: {
    backgroundColor: bloomColors.gold,
    top: 34,
    transform: [{ rotate: "-5deg" }],
    width: 100,
  },
  bloomBandTeal: {
    backgroundColor: bloomColors.teal,
    top: 22,
    transform: [{ rotate: "5deg" }],
    width: 122,
  },
  bloomBandViolet: {
    backgroundColor: bloomColors.violet,
    top: 46,
    transform: [{ rotate: "7deg" }],
    width: 72,
  },
  bloomBands: {
    alignItems: "center",
    height: 70,
    justifyContent: "center",
    width: 132,
  },
  bloomSide: {
    borderRadius: 999,
    height: 18,
    position: "absolute",
    width: 5,
  },
  bloomSideLeft: {
    backgroundColor: bloomColors.coral,
    left: 8,
    top: 34,
  },
  bloomSideRight: {
    backgroundColor: bloomColors.violet,
    right: 8,
    top: 36,
  },
  bloomWrap: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 104,
  },
  checkbox: {
    alignItems: "center",
    borderColor: bloomColors.soft,
    borderRadius: 8,
    borderWidth: 1.5,
    height: 26,
    justifyContent: "center",
    width: 26,
  },
  checkboxChecked: {
    backgroundColor: bloomColors.teal,
    borderColor: bloomColors.teal,
  },
  checkboxMark: {
    color: bloomColors.cream,
    fontSize: 15,
    fontWeight: "700",
  },
  chrome: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 22,
    paddingTop: 8,
  },
  chromeButtonText: {
    color: bloomColors.soft,
    fontSize: 20,
    letterSpacing: 2,
    lineHeight: 24,
  },
  consentRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 14,
    paddingVertical: 16,
  },
  controlColumn: {
    alignItems: "center",
    gap: 14,
    paddingBottom: 18,
    paddingTop: 14,
  },
  copy: {
    color: bloomColors.soft,
    fontSize: 16,
    lineHeight: 25,
  },
  error: {
    color: bloomColors.coral,
    fontSize: 14,
    lineHeight: 20,
    paddingHorizontal: 24,
    textAlign: "center",
  },
  eyebrow: {
    color: bloomColors.teal,
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  flexFill: {
    flex: 1,
  },
  languageRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 14,
    minHeight: 28,
  },
  languageText: {
    color: bloomColors.plum,
    fontSize: 16,
    fontWeight: "700",
  },
  listenPill: {
    alignItems: "center",
    backgroundColor: bloomColors.coral,
    borderRadius: 999,
    minHeight: 54,
    minWidth: 176,
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  listenPillText: {
    color: bloomColors.cream,
    fontSize: 17,
    fontWeight: "800",
  },
  modeTab: {
    color: bloomColors.soft,
    fontSize: 15,
    fontWeight: "600",
  },
  modeTabActive: {
    color: bloomColors.plum,
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
    gap: 16,
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  onboardingFooter: {
    alignItems: "center",
    paddingBottom: 26,
    paddingHorizontal: 28,
    paddingTop: 10,
  },
  pressed: {
    opacity: 0.55,
  },
  receipt: {
    color: bloomColors.teal,
    fontSize: 14,
    paddingHorizontal: 24,
    textAlign: "center",
  },
  rtlText: {
    textAlign: "right",
    writingDirection: "rtl",
  },
  screen: {
    backgroundColor: bloomColors.cream,
    flex: 1,
  },
  setupRow: {
    borderBottomColor: bloomColors.hairline,
    borderBottomWidth: 1.5,
    gap: 6,
    paddingVertical: 18,
  },
  setupValue: {
    color: bloomColors.plum,
    fontSize: 24,
    fontWeight: "700",
  },
  sourceText: {
    color: bloomColors.soft,
    fontSize: 15,
    lineHeight: 23,
  },
  signalBar: {
    borderRadius: 999,
    height: 12,
    width: 4,
  },
  signalBarCoral: {
    backgroundColor: bloomColors.coral,
  },
  signalBarGold: {
    backgroundColor: bloomColors.gold,
    height: 18,
  },
  signalBarTeal: {
    backgroundColor: bloomColors.teal,
    height: 16,
  },
  signalBarViolet: {
    backgroundColor: bloomColors.violet,
    height: 10,
  },
  signalWrap: {
    alignItems: "center",
    flexDirection: "row",
    gap: 4,
    justifyContent: "center",
    minHeight: 28,
    paddingTop: 6,
  },
  swapText: {
    color: bloomColors.teal,
    fontSize: 18,
    fontWeight: "700",
  },
  timelineContent: {
    gap: 18,
    paddingBottom: 24,
    paddingHorizontal: 30,
    paddingTop: 12,
  },
  timelineTranslation: {
    color: bloomColors.plum,
    fontSize: 28,
    fontWeight: "700",
    lineHeight: 36,
  },
  title: {
    color: bloomColors.plum,
    fontSize: 32,
    fontWeight: "800",
    lineHeight: 40,
  },
  translationPartial: {
    opacity: 0.5,
  },
  wordmark: {
    color: bloomColors.plum,
    fontSize: 16,
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
});
