import { StyleSheet } from "react-native";

export const auraColors = {
  blue: "#3F9EEA",
  coral: "#F0655A",
  ghost: "#9A93A8",
  hairline: "rgba(242, 237, 228, 0.14)",
  moon: "#F2EDE4",
  teal: "#2FB9A5",
  violet: "#8F7BE0",
  void: "#0E0D14",
} as const;

export const styles = StyleSheet.create({
  chrome: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingTop: 10,
  },
  chromeButtonText: {
    color: auraColors.ghost,
    fontSize: 22,
    letterSpacing: 2,
    lineHeight: 24,
  },
  chromeStatus: {
    color: auraColors.ghost,
    fontSize: 13,
    letterSpacing: 0.4,
  },
  consentRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    paddingVertical: 14,
  },
  controlRow: {
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 24,
    paddingTop: 14,
  },
  controlText: {
    color: auraColors.moon,
    fontSize: 15,
    letterSpacing: 0.2,
  },
  error: {
    color: auraColors.coral,
    fontSize: 13,
    lineHeight: 19,
    paddingHorizontal: 24,
    textAlign: "center",
  },
  eyebrow: {
    color: auraColors.ghost,
    fontSize: 12,
    letterSpacing: 2.4,
    textTransform: "uppercase",
  },
  footer: {
    paddingBottom: 18,
    paddingTop: 4,
  },
  ghostButton: {
    alignItems: "center",
    borderColor: auraColors.hairline,
    borderRadius: 999,
    borderWidth: 1,
    minHeight: 52,
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  ghostButtonText: {
    color: auraColors.moon,
    fontSize: 15,
    letterSpacing: 0.6,
  },
  grain: {
    ...StyleSheet.absoluteFillObject,
    height: undefined,
    opacity: 0.05,
    width: undefined,
  },
  hairline: {
    backgroundColor: auraColors.hairline,
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 24,
  },
  languageRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
  modeTab: {
    color: auraColors.ghost,
    fontSize: 13,
    letterSpacing: 0.4,
  },
  modeTabActive: {
    color: auraColors.moon,
    fontSize: 13,
    letterSpacing: 0.4,
  },
  modeTabs: {
    alignItems: "center",
    flexDirection: "row",
    gap: 14,
  },
  onboardingBody: {
    flex: 1,
    gap: 16,
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  onboardingCopy: {
    color: auraColors.ghost,
    fontSize: 15,
    lineHeight: 23,
  },
  onboardingFooter: {
    paddingBottom: 24,
    paddingHorizontal: 28,
    paddingTop: 8,
  },
  onboardingTitle: {
    color: auraColors.moon,
    fontSize: 34,
    fontWeight: "400",
    letterSpacing: -0.4,
    lineHeight: 42,
  },
  orb: {
    borderRadius: 999,
    position: "absolute",
  },
  pressed: {
    opacity: 0.5,
  },
  receipt: {
    color: auraColors.teal,
    fontSize: 13,
    paddingHorizontal: 24,
    textAlign: "center",
  },
  ring: {
    alignItems: "center",
    borderColor: auraColors.coral,
    borderRadius: 999,
    borderWidth: 1.5,
    height: 76,
    justifyContent: "center",
    width: 76,
  },
  ringGlow: {
    backgroundColor: auraColors.coral,
    borderRadius: 999,
    height: 96,
    opacity: 0.18,
    position: "absolute",
    width: 96,
  },
  ringLabel: {
    color: auraColors.moon,
    fontSize: 13,
    letterSpacing: 0.6,
  },
  ringWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 22,
  },
  rtlText: {
    textAlign: "right",
    writingDirection: "rtl",
  },
  screen: {
    backgroundColor: auraColors.void,
    flex: 1,
  },
  setupCheckbox: {
    alignItems: "center",
    borderColor: auraColors.ghost,
    borderRadius: 4,
    borderWidth: 1,
    height: 22,
    justifyContent: "center",
    width: 22,
  },
  setupCheckboxChecked: {
    backgroundColor: auraColors.teal,
    borderColor: auraColors.teal,
  },
  setupCheckboxMark: {
    color: auraColors.void,
    fontSize: 13,
    fontWeight: "700",
  },
  setupRow: {
    borderBottomColor: auraColors.hairline,
    borderBottomWidth: 1,
    gap: 6,
    paddingVertical: 16,
  },
  setupValue: {
    color: auraColors.moon,
    fontSize: 22,
    fontWeight: "400",
  },
  sourceText: {
    color: auraColors.ghost,
    fontSize: 15,
    lineHeight: 22,
  },
  stage: {
    flexGrow: 1,
    gap: 18,
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  stageScroll: {
    flex: 1,
  },
  timelineContent: {
    gap: 20,
    paddingBottom: 24,
    paddingHorizontal: 28,
    paddingTop: 16,
  },
  timelineTranslation: {
    color: auraColors.moon,
    fontSize: 21,
    fontWeight: "400",
    lineHeight: 30,
  },
  translationPartial: {
    opacity: 0.55,
  },
  translationText: {
    color: auraColors.moon,
    fontSize: 36,
    fontWeight: "400",
    letterSpacing: -0.3,
    lineHeight: 47,
  },
});
