import { StyleSheet } from "react-native";
import type { ImageStyle, TextStyle, ViewStyle } from "react-native";

type AppStyles = {
  appChrome: ViewStyle;
  bottomDock: ViewStyle;
  brandMini: ViewStyle;
  brandMiniLogo: ImageStyle;
  brandMiniText: TextStyle;
  brand: TextStyle;
  brandMark: ViewStyle;
  brandLogo: ImageStyle;
  diagnosticButton: ViewStyle;
  diagnosticButtonSecondary: ViewStyle;
  diagnosticButtonText: TextStyle;
  diagnosticButtonTextSecondary: TextStyle;
  diagnosticActions: ViewStyle;
  diagnosticsMessage: TextStyle;
  diagnosticsContent: ViewStyle;
  modelRouteDetail: TextStyle;
  modelRouteMeta: TextStyle;
  emptyTranslatedText: TextStyle;
  error: TextStyle;
  healthText: TextStyle;
  iconButton: ViewStyle;
  iconButtonText: TextStyle;
  languageArrow: TextStyle;
  languageButton: ViewStyle;
  languageLabel: TextStyle;
  languageList: ViewStyle;
  languageOption: ViewStyle;
  languageOptionCheck: TextStyle;
  languageOptionName: TextStyle;
  languageOptionNative: TextStyle;
  languageOptionSelected: ViewStyle;
  languagePill: ViewStyle;
  languagePillArrow: TextStyle;
  languagePillSide: ViewStyle;
  languagePillText: TextStyle;
  languageSwapButton: ViewStyle;
  languageSwapText: TextStyle;
  languageStrip: ViewStyle;
  languageValue: TextStyle;
  latencyLabel: TextStyle;
  latencyRow: ViewStyle;
  latencyValue: TextStyle;
  listenButton: ViewStyle;
  listenHint: TextStyle;
  listenButtonText: TextStyle;
  metric: ViewStyle;
  metricLabel: TextStyle;
  metricsRow: ViewStyle;
  metricValue: TextStyle;
  modeButton: ViewStyle;
  modeButtonActive: ViewStyle;
  modeButtonText: TextStyle;
  modeButtonTextActive: TextStyle;
  modeToggle: ViewStyle;
  modalScrim: ViewStyle;
  onboarding: ViewStyle;
  onboardingBody: ViewStyle;
  onboardingCenter: ViewStyle;
  onboardingScroll: ViewStyle;
  onboardingButton: ViewStyle;
  onboardingButtonText: TextStyle;
  onboardingCopy: TextStyle;
  onboardingEyebrow: TextStyle;
  onboardingFooter: ViewStyle;
  onboardingHeader: ViewStyle;
  onboardingTitle: TextStyle;
  pressed: ViewStyle;
  privacyHero: ViewStyle;
  privacyHeroCopy: TextStyle;
  privacyHeroTitle: TextStyle;
  privacyCheckbox: ViewStyle;
  privacyCheckboxChecked: ViewStyle;
  privacyCheckboxMark: TextStyle;
  privacyConsentRow: ViewStyle;
  privacyConsentText: TextStyle;
  privacyDetails: ViewStyle;
  privacyDetailText: TextStyle;
  privacyMic: ViewStyle;
  privacyMicCapsule: ViewStyle;
  privacyMicStem: ViewStyle;
  privacyPulseInner: ViewStyle;
  privacyPulseOuter: ViewStyle;
  previewArrow: TextStyle;
  previewHeader: ViewStyle;
  heroGlowOne: ViewStyle;
  heroGlowTwo: ViewStyle;
  previewLanguage: TextStyle;
  previewMeter: ViewStyle;
  previewMeterBar: ViewStyle;
  previewMeterBarShort: ViewStyle;
  previewMeterBarTall: ViewStyle;
  previewSource: TextStyle;
  previewTranslation: TextStyle;
  receipt: TextStyle;
  reportButton: ViewStyle;
  reportButtonText: TextStyle;
  reportRow: ViewStyle;
  rtlText: TextStyle;
  screen: ViewStyle;
  searchInput: TextStyle;
  settingsAction: ViewStyle;
  settingsActionText: TextStyle;
  settingsChevron: TextStyle;
  settingsList: ViewStyle;
  settingsMessage: TextStyle;
  setupButton: ViewStyle;
  setupConnector: ViewStyle;
  setupConnectorText: TextStyle;
  setupHero: ViewStyle;
  setupLabel: TextStyle;
  setupRows: ViewStyle;
  setupTitle: TextStyle;
  setupValue: TextStyle;
  sheet: ViewStyle;
  sheetDone: ViewStyle;
  sheetDoneText: TextStyle;
  sheetHeader: ViewStyle;
  sheetTitle: TextStyle;
  sourceText: TextStyle;
  spanRow: ViewStyle;
  spanSource: TextStyle;
  spanTranslation: TextStyle;
  speechIndicator: ViewStyle;
  status: TextStyle;
  statusCluster: ViewStyle;
  statusDot: ViewStyle;
  statusDotDegraded: ViewStyle;
  statusDotDisconnected: ViewStyle;
  statusDotLive: ViewStyle;
  statusDotRecovering: ViewStyle;
  statusLive: TextStyle;
  stopButton: ViewStyle;
  textButton: ViewStyle;
  textButtonText: TextStyle;
  timeline: ViewStyle;
  timelineContent: ViewStyle;
  timelineEmpty: TextStyle;
  timelineScroll: ViewStyle;
  translatedText: TextStyle;
  translatedTextPartial: TextStyle;
  translationContent: ViewStyle;
  translationEmptyArt: ViewStyle;
  translationEmptyHalo: ViewStyle;
  translationEmptyLogo: ImageStyle;
  translationEmptyMic: ViewStyle;
  translationEmptyMicCapsule: ViewStyle;
  translationEmptyMicStem: ViewStyle;
  translationKicker: TextStyle;
  translationSurface: ViewStyle;
  welcomeHero: ViewStyle;
};

export const styles = StyleSheet.create<AppStyles>({
  appChrome: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingTop: 6,
  },
  bottomDock: {
    gap: 12,
    paddingBottom: 20,
    paddingHorizontal: 24,
  },
  brandMini: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: "#D8F3E8",
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    minHeight: 42,
    paddingHorizontal: 16,
  },
  brandMiniLogo: {
    borderRadius: 999,
    height: 24,
    width: 24,
  },
  brandMiniText: {
    color: "#123D35",
    fontSize: 15,
    fontWeight: "900",
  },
  healthText: {
    color: "#5A6862",
    fontSize: 12,
    fontWeight: "800",
  },
  brand: {
    color: "#161614",
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: 0,
  },
  brandMark: {
    alignItems: "center",
    backgroundColor: "#F8F4ED",
    borderColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 2,
    height: 48,
    justifyContent: "center",
    shadowColor: "#18A999",
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    width: 48,
  },
  brandLogo: {
    borderRadius: 14,
    height: 40,
    width: 40,
  },
  timelineContent: {
    flexGrow: 1,
    gap: 12,
    justifyContent: "flex-start",
    paddingBottom: 28,
    paddingHorizontal: 24,
    paddingTop: 18,
  },
  timelineScroll: {
    flex: 1,
  },
  diagnosticButton: {
    alignItems: "center",
    backgroundColor: "#0E7C68",
    borderRadius: 999,
    minHeight: 46,
    justifyContent: "center",
  },
  diagnosticButtonSecondary: {
    alignItems: "center",
    backgroundColor: "#EFFAF6",
    borderColor: "#CBEFE2",
    borderRadius: 999,
    borderWidth: 1,
    flex: 1,
    minHeight: 44,
    justifyContent: "center",
  },
  diagnosticButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
  diagnosticButtonTextSecondary: {
    color: "#0E5F51",
    fontSize: 13,
    fontWeight: "800",
  },
  diagnosticActions: {
    gap: 8,
  },
  diagnosticsMessage: {
    color: "#0E5F51",
    fontSize: 13,
    fontWeight: "800",
    textAlign: "center",
  },
  diagnosticsContent: {
    gap: 12,
    paddingBottom: 24,
  },
  modelRouteDetail: {
    color: "#716B63",
    fontSize: 13,
    fontWeight: "700",
    marginTop: 3,
  },
  modelRouteMeta: {
    color: "#7A827D",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 14,
    paddingBottom: 16,
  },
  error: {
    backgroundColor: "#FFF0EE",
    borderRadius: 18,
    color: "#8C1D0F",
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20,
    padding: 14,
  },
  iconButton: {
    alignItems: "center",
    backgroundColor: "#EFFAF6",
    borderRadius: 999,
    minHeight: 42,
    minWidth: 64,
    paddingHorizontal: 14,
    justifyContent: "center",
  },
  iconButtonText: {
    color: "#282826",
    fontSize: 14,
    fontWeight: "800",
  },
  languageArrow: {
    color: "#7F7970",
    fontSize: 16,
    fontWeight: "900",
    paddingHorizontal: 10,
  },
  languagePill: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: "#D8F3E8",
    borderWidth: 1,
    borderRadius: 999,
    flexDirection: "row",
    justifyContent: "center",
    maxWidth: 320,
    minHeight: 48,
    paddingHorizontal: 10,
    shadowColor: "#18A999",
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
  },
  languagePillArrow: {
    color: "#8A8984",
    fontSize: 14,
    fontWeight: "900",
    paddingHorizontal: 2,
  },
  languagePillSide: {
    alignItems: "center",
    flexShrink: 1,
    justifyContent: "center",
    minHeight: 40,
    paddingHorizontal: 10,
  },
  languagePillText: {
    color: "#171717",
    fontSize: 15,
    fontWeight: "800",
  },
  languageSwapButton: {
    alignItems: "center",
    borderColor: "#D8F3E8",
    borderLeftWidth: 1,
    borderRightWidth: 1,
    justifyContent: "center",
    minHeight: 36,
    minWidth: 44,
  },
  languageSwapText: {
    color: "#68645F",
    fontSize: 14,
    fontWeight: "900",
  },
  languageButton: {
    flex: 1,
    gap: 3,
    minHeight: 58,
    justifyContent: "center",
  },
  languageLabel: {
    color: "#827B72",
    fontSize: 12,
    fontWeight: "700",
  },
  languageList: {
    gap: 8,
    paddingBottom: 28,
  },
  languageOption: {
    alignItems: "center",
    borderBottomColor: "#E7E2DA",
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 64,
  },
  languageOptionCheck: {
    color: "#126B45",
    fontSize: 13,
    fontWeight: "800",
  },
  languageOptionName: {
    color: "#191714",
    fontSize: 18,
    fontWeight: "800",
  },
  languageOptionNative: {
    color: "#716B63",
    fontSize: 13,
    fontWeight: "700",
    marginTop: 3,
  },
  languageOptionSelected: {
    borderBottomColor: "#151515",
  },
  languageStrip: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingTop: 18,
  },
  languageValue: {
    color: "#181512",
    fontSize: 20,
    fontWeight: "900",
  },
  latencyLabel: {
    color: "#726B63",
    flexBasis: 120,
    fontSize: 12,
    fontWeight: "800",
  },
  latencyRow: {
    alignItems: "center",
    borderBottomColor: "#ECE6DD",
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 10,
    minHeight: 42,
  },
  latencyValue: {
    color: "#191714",
    flex: 1,
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 17,
  },
  listenButton: {
    alignItems: "center",
    backgroundColor: "#FF6B4A",
    borderRadius: 999,
    justifyContent: "center",
    minHeight: 64,
    shadowColor: "#FF6B4A",
    shadowOffset: { height: 10, width: 0 },
    shadowOpacity: 0.22,
    shadowRadius: 20,
  },
  listenHint: {
    color: "#6B7B72",
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
  },
  listenButtonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "900",
  },
  metric: {
    backgroundColor: "#F7F4EF",
    borderRadius: 10,
    flex: 1,
    minHeight: 62,
    padding: 10,
  },
  metricLabel: {
    color: "#777068",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  metricsRow: {
    flexDirection: "row",
    gap: 8,
  },
  metricValue: {
    color: "#181512",
    fontSize: 16,
    fontWeight: "800",
    marginTop: 6,
  },
  modeToggle: {
    alignSelf: "center",
    backgroundColor: "#FFFFFF",
    borderColor: "#DDEBE4",
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 4,
    marginTop: 12,
    padding: 4,
  },
  modeButton: {
    alignItems: "center",
    borderRadius: 999,
    minWidth: 104,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  modeButtonActive: {
    backgroundColor: "#123D35",
  },
  modeButtonText: {
    color: "#5F6A64",
    fontSize: 13,
    fontWeight: "900",
  },
  modeButtonTextActive: {
    color: "#FFFFFF",
  },
  modalScrim: {
    backgroundColor: "rgba(0,0,0,0.22)",
    flex: 1,
    justifyContent: "flex-end",
  },
  onboarding: {
    flex: 1,
    padding: 24,
  },
  onboardingBody: {
    marginTop: 30,
  },
  onboardingCenter: {
    flex: 1,
    justifyContent: "center",
    paddingBottom: 18,
  },
  onboardingScroll: {
    flexGrow: 1,
    padding: 24,
  },
  onboardingButton: {
    alignItems: "center",
    backgroundColor: "#FF6B4A",
    borderRadius: 999,
    justifyContent: "center",
    minHeight: 56,
    shadowColor: "#FF6B4A",
    shadowOffset: { height: 10, width: 0 },
    shadowOpacity: 0.24,
    shadowRadius: 20,
  },
  onboardingButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },
  onboardingCopy: {
    color: "#696762",
    fontSize: 17,
    fontWeight: "500",
    lineHeight: 25,
    marginTop: 12,
  },
  onboardingEyebrow: {
    color: "#716B63",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0,
    marginBottom: 12,
    textTransform: "uppercase",
  },
  onboardingFooter: {
    marginTop: "auto",
    paddingBottom: 10,
  },
  onboardingHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    paddingTop: 8,
  },
  onboardingTitle: {
    color: "#151513",
    fontSize: 32,
    fontWeight: "800",
    letterSpacing: 0,
    lineHeight: 38,
  },
  pressed: {
    opacity: 0.5,
  },
  privacyHero: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: "#D7F5E8",
    borderRadius: 26,
    borderWidth: 1,
    justifyContent: "center",
    marginTop: 24,
    minHeight: 430,
    overflow: "hidden",
    padding: 24,
    shadowColor: "#18A999",
    shadowOffset: { height: 16, width: 0 },
    shadowOpacity: 0.14,
    shadowRadius: 28,
  },
  privacyHeroCopy: {
    color: "#667069",
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 22,
    marginTop: 10,
    maxWidth: 310,
    textAlign: "center",
  },
  privacyHeroTitle: {
    color: "#143D36",
    fontSize: 28,
    fontWeight: "800",
    lineHeight: 34,
    marginTop: 26,
    textAlign: "center",
  },
  privacyCheckbox: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: "#8DE5C4",
    borderRadius: 8,
    borderWidth: 2,
    height: 26,
    justifyContent: "center",
    width: 26,
  },
  privacyCheckboxChecked: {
    backgroundColor: "#0E7C68",
    borderColor: "#0E7C68",
  },
  privacyCheckboxMark: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "900",
    lineHeight: 20,
  },
  privacyConsentRow: {
    alignItems: "center",
    backgroundColor: "#F4FFFA",
    borderColor: "#C9F6E0",
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    marginTop: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    width: "100%",
  },
  privacyConsentText: {
    color: "#143D36",
    flex: 1,
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 19,
  },
  privacyDetails: {
    gap: 7,
    marginTop: 14,
    width: "100%",
  },
  privacyDetailText: {
    color: "#696762",
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
    textAlign: "center",
  },
  privacyMic: {
    alignItems: "center",
    backgroundColor: "#0E7C68",
    borderRadius: 38,
    height: 76,
    justifyContent: "center",
    width: 76,
    zIndex: 2,
  },
  privacyMicCapsule: {
    backgroundColor: "#FFFFFF",
    borderRadius: 999,
    height: 34,
    width: 18,
  },
  privacyMicStem: {
    backgroundColor: "#FFFFFF",
    borderRadius: 999,
    height: 18,
    marginTop: -2,
    width: 5,
  },
  privacyPulseInner: {
    backgroundColor: "#FFD166",
    borderRadius: 999,
    height: 138,
    opacity: 0.24,
    position: "absolute",
    top: 78,
    width: 138,
  },
  privacyPulseOuter: {
    backgroundColor: "#FF8A65",
    borderRadius: 999,
    height: 210,
    opacity: 0.16,
    position: "absolute",
    top: 42,
    width: 210,
  },
  previewArrow: {
    color: "#B9F5E5",
    fontSize: 13,
    fontWeight: "900",
  },
  previewHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
  },
  previewLanguage: {
    color: "#F8FFFC",
    fontSize: 13,
    fontWeight: "800",
  },
  previewMeter: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
    marginTop: 24,
  },
  previewMeterBar: {
    backgroundColor: "#FFD166",
    borderRadius: 999,
    height: 28,
    opacity: 0.9,
    width: 6,
  },
  previewMeterBarShort: {
    height: 14,
    opacity: 0.75,
  },
  previewMeterBarTall: {
    height: 42,
  },
  previewSource: {
    color: "#D8FFF4",
    fontSize: 16,
    fontWeight: "600",
    lineHeight: 23,
    marginTop: 12,
    textAlign: "center",
  },
  previewTranslation: {
    color: "#FFFFFF",
    fontSize: 32,
    fontWeight: "800",
    lineHeight: 42,
    marginTop: 28,
    textAlign: "center",
    writingDirection: "rtl",
  },
  receipt: {
    backgroundColor: "#DCE8E1",
    borderRadius: 10,
    color: "#163A2C",
    fontSize: 14,
    fontWeight: "700",
    padding: 12,
  },
  reportButton: {
    backgroundColor: "#30302F",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  reportButtonText: {
    color: "#F3EFE8",
    fontSize: 12,
    fontWeight: "800",
  },
  reportRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 6,
  },
  rtlText: {
    textAlign: "right",
    writingDirection: "rtl",
  },
  screen: {
    backgroundColor: "#F4FFF9",
    flex: 1,
  },
  searchInput: {
    backgroundColor: "#F3EFE8",
    borderRadius: 14,
    color: "#161412",
    fontSize: 17,
    fontWeight: "700",
    minHeight: 50,
    paddingHorizontal: 16,
  },
  settingsAction: {
    alignItems: "center",
    borderBottomColor: "#E7E2DA",
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 58,
  },
  settingsActionText: {
    color: "#191714",
    fontSize: 17,
    fontWeight: "800",
  },
  settingsChevron: {
    color: "#8A847B",
    fontSize: 24,
    fontWeight: "700",
  },
  settingsList: {
    marginTop: 8,
  },
  settingsMessage: {
    color: "#4D4740",
    fontSize: 13,
    fontWeight: "700",
    marginTop: 16,
  },
  setupButton: {
    backgroundColor: "#FFFFFF",
    borderColor: "#DDF4EA",
    borderRadius: 22,
    borderWidth: 1,
    minHeight: 86,
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  setupConnector: {
    alignItems: "center",
    alignSelf: "center",
    backgroundColor: "#FF6B4A",
    borderRadius: 999,
    height: 34,
    justifyContent: "center",
    marginVertical: -2,
    width: 52,
    zIndex: 2,
  },
  setupConnectorText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900",
  },
  setupHero: {
    backgroundColor: "#EFFFF8",
    borderRadius: 32,
    padding: 24,
    shadowColor: "#18A999",
    shadowOffset: { height: 16, width: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 28,
  },
  setupLabel: {
    color: "#6B7B72",
    fontSize: 13,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  setupRows: {
    gap: 0,
    marginTop: 24,
  },
  setupTitle: {
    color: "#151513",
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: 0,
    lineHeight: 36,
  },
  setupValue: {
    color: "#123D35",
    fontSize: 24,
    fontWeight: "900",
    marginTop: 5,
  },
  sheet: {
    backgroundColor: "#FCFFFD",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "86%",
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  sheetDone: {
    minHeight: 40,
    justifyContent: "center",
  },
  sheetDoneText: {
    color: "#126B45",
    fontSize: 16,
    fontWeight: "900",
  },
  sheetHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  sheetTitle: {
    color: "#111111",
    fontSize: 24,
    fontWeight: "900",
  },
  sourceText: {
    color: "#77736C",
    fontSize: 17,
    fontWeight: "600",
    lineHeight: 25,
    marginTop: 18,
    maxWidth: 420,
  },
  spanRow: {
    borderBottomColor: "#E7E2DA",
    borderBottomWidth: 1,
    gap: 6,
    paddingVertical: 12,
  },
  spanSource: {
    color: "#68615A",
    fontSize: 13,
    fontWeight: "700",
  },
  spanTranslation: {
    color: "#181512",
    fontSize: 17,
    fontWeight: "800",
    lineHeight: 24,
  },
  speechIndicator: {
    alignItems: "flex-end",
  },
  status: {
    color: "#686862",
    fontSize: 13,
    fontWeight: "800",
  },
  statusCluster: {
    alignItems: "center",
    flexDirection: "row",
    gap: 7,
  },
  statusDot: {
    backgroundColor: "#B9B8B2",
    borderRadius: 999,
    height: 7,
    width: 7,
  },
  statusDotDegraded: {
    backgroundColor: "#D58A18",
  },
  statusDotDisconnected: {
    backgroundColor: "#C63A30",
  },
  statusDotLive: {
    backgroundColor: "#14A05A",
  },
  statusDotRecovering: {
    backgroundColor: "#2878D8",
  },
  statusLive: {
    color: "#126B45",
  },
  stopButton: {
    backgroundColor: "#E14B3B",
  },
  textButton: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
  },
  textButtonText: {
    color: "#625C54",
    fontSize: 15,
    fontWeight: "800",
  },
  welcomeHero: {
    backgroundColor: "#0D7C66",
    borderRadius: 32,
    marginTop: 36,
    minHeight: 310,
    overflow: "hidden",
    paddingHorizontal: 24,
    paddingTop: 22,
    shadowColor: "#0D7C66",
    shadowOffset: { height: 18, width: 0 },
    shadowOpacity: 0.24,
    shadowRadius: 28,
  },
  heroGlowOne: {
    backgroundColor: "#FF8A65",
    borderRadius: 999,
    height: 150,
    opacity: 0.72,
    position: "absolute",
    right: -42,
    top: -48,
    width: 150,
  },
  heroGlowTwo: {
    backgroundColor: "#35D0BA",
    borderRadius: 999,
    bottom: -56,
    height: 170,
    left: -54,
    opacity: 0.55,
    position: "absolute",
    width: 170,
  },
  timeline: {
    paddingTop: 4,
  },
  timelineEmpty: {
    color: "#68615A",
    fontSize: 14,
    fontWeight: "700",
  },
  translatedText: {
    color: "#111111",
    fontSize: 38,
    fontWeight: "800",
    letterSpacing: 0,
    lineHeight: 47,
    maxWidth: 520,
  },
  translatedTextPartial: {
    opacity: 0.52,
  },
  emptyTranslatedText: {
    color: "#143D36",
    fontSize: 34,
    fontWeight: "800",
    lineHeight: 41,
  },
  translationContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 34,
    paddingBottom: 34,
    paddingTop: 18,
  },
  translationEmptyArt: {
    alignItems: "center",
    alignSelf: "flex-start",
    height: 112,
    justifyContent: "center",
    marginBottom: 24,
    width: 112,
  },
  translationEmptyHalo: {
    backgroundColor: "#FFF4C8",
    borderRadius: 999,
    height: 112,
    opacity: 0.68,
    position: "absolute",
    width: 112,
  },
  translationEmptyLogo: {
    borderRadius: 24,
    height: 76,
    width: 76,
  },
  translationEmptyMic: {
    alignItems: "center",
    backgroundColor: "#0E7C68",
    borderRadius: 32,
    height: 64,
    justifyContent: "center",
    width: 64,
  },
  translationEmptyMicCapsule: {
    backgroundColor: "#FFFFFF",
    borderRadius: 999,
    height: 28,
    width: 15,
  },
  translationEmptyMicStem: {
    backgroundColor: "#FFFFFF",
    borderRadius: 999,
    height: 15,
    marginTop: -1,
    width: 4,
  },
  translationKicker: {
    color: "#0E7C68",
    fontSize: 13,
    fontWeight: "900",
    marginBottom: 10,
    textTransform: "uppercase",
  },
  translationSurface: {
    flex: 1,
  },
});
