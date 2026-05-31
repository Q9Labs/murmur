import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  Image,
  type ImageStyle,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  type TextStyle,
  TextInput,
  View,
  type ViewStyle,
} from "react-native";
import * as Network from "expo-network";
import { SafeAreaView } from "react-native-safe-area-context";

import MurmurAudioModule, { type AudioStateEvent } from "../modules/murmur-audio";
import {
  acknowledgePrivacyDisclosure,
  deleteLocalMurmurData,
  hasAcknowledgedPrivacyDisclosure,
  resetInstallId,
} from "../lib/installIdentity";
import {
  buildLatencyEvidenceReport,
  type DebugLogEntry,
  formatLatencyEvidenceReport,
  formatLatencyPercentiles,
} from "../lib/latency";
import type { LatencySample } from "../lib/latency";
import {
  autoSourceLanguageCode,
  getLanguage,
  languageRegistry,
  type LanguageCode,
  type SourceLanguageCode,
} from "../lib/languages";
import { canStartSession, type TranslationSpan } from "../lib/session";
import { useLiveTranslation } from "../lib/useLiveTranslation";
import type { ReportTranslationCategory } from "../lib/transport/types";
import type { TranslationMode } from "../lib/transport/types";

type OnboardingStep = "welcome" | "privacy" | "languages" | "done";
type PickerMode = "source" | "target" | null;
type DiagnosticsReportParams = {
  appSessionId: string;
  debugLog: DebugLogEntry[];
  networkType: string;
  providerRoute: string;
  samples: LatencySample[];
  sourceLanguage: SourceLanguageCode;
  targetLanguage: LanguageCode;
};
const brandLogo = require("../assets/images/icon.png");

type AppStyles = {
  appChrome: ViewStyle;
  bottomDock: ViewStyle;
  brandMini: ViewStyle;
  brandMiniLogo: ImageStyle;
  brandMiniText: TextStyle;
  brand: TextStyle;
  brandMark: ViewStyle;
  brandLogo: ImageStyle;
  continuousContent: ViewStyle;
  continuousEmpty: TextStyle;
  continuousFooterText: TextStyle;
  continuousHeader: ViewStyle;
  continuousSourcePanel: ViewStyle;
  continuousStatus: TextStyle;
  continuousTimeline: ViewStyle;
  diagnosticButton: ViewStyle;
  diagnosticButtonSecondary: ViewStyle;
  diagnosticButtonText: TextStyle;
  diagnosticButtonTextSecondary: TextStyle;
  diagnosticActions: ViewStyle;
  diagnosticsMessage: TextStyle;
  diagnosticsContent: ViewStyle;
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
  timelineEmpty: TextStyle;
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

const reportActions = [
  { category: "inaccurate", label: "Inaccurate" },
  { category: "wrong_language", label: "Wrong language" },
  { category: "offensive_harmful", label: "Harmful" },
  { category: "speech_issue", label: "Speech" },
  { category: "other", label: "Other" },
] as const satisfies readonly {
  category: ReportTranslationCategory;
  label: string;
}[];

export default function Index(): ReactNode {
  const [sourceLanguageCode, setSourceLanguageCode] = useState<SourceLanguageCode>("en");
  const [targetLanguageCode, setTargetLanguageCode] = useState<LanguageCode>("ar");
  const [translationMode, setTranslationMode] = useState<TranslationMode>("phrase");
  const [onboardingStep, setOnboardingStep] = useState<OnboardingStep>("welcome");
  const [privacyAcknowledged, setPrivacyAcknowledged] = useState(false);
  const [privacyConsentChecked, setPrivacyConsentChecked] = useState(false);
  const [pickerMode, setPickerMode] = useState<PickerMode>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null);
  const continuousTimelineRef = useRef<ScrollView | null>(null);
  const continuousAutoScrollRef = useRef(true);
  const continuousUserInteractedRef = useRef(false);
  const [audioState, setAudioState] = useState<AudioStateEvent | null>(null);
  const [networkType, setNetworkType] = useState<string>("unknown");

  const sourceLanguage = sourceLanguageCode === autoSourceLanguageCode ? null : getLanguage(sourceLanguageCode);
  const targetLanguage = getLanguage(targetLanguageCode);
  const sourceLanguageDisplayName = sourceLanguage?.display_name ?? "Auto detect";
  const live = useLiveTranslation({
    source_language: sourceLanguageCode,
    target_language: targetLanguage.app_code,
    translation_mode: translationMode,
  });

  useEffect(() => {
    let mounted = true;
    void hasAcknowledgedPrivacyDisclosure().then((acknowledged) => {
      if (mounted) {
        setPrivacyAcknowledged(acknowledged);
      }
      if (mounted && acknowledged) {
        setOnboardingStep("done");
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const subscription = MurmurAudioModule.addListener(
      "onAudioState",
      (nextState: AudioStateEvent) => setAudioState(nextState),
    );
    void MurmurAudioModule.getAudioState().then((nextState) => {
      setAudioState(nextState as AudioStateEvent);
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    let mounted = true;
    void Network.getNetworkStateAsync()
      .then((state) => {
        if (mounted) {
          setNetworkType(state.type ?? "unknown");
        }
      })
      .catch(() => undefined);
    const subscription = Network.addNetworkStateListener((state) => {
      setNetworkType(state.type ?? "unknown");
    });
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  const latestTranslation = [...live.spans]
    .reverse()
    .find((span) => span.committed_translated_caption?.trim() || span.partial_translated_caption?.trim());
  const latestTranslationText =
    latestTranslation?.committed_translated_caption ||
    latestTranslation?.partial_translated_caption ||
    latestTranslation?.translated_caption ||
    "";
  const latestTranslationIsPartial =
    Boolean(latestTranslation?.partial_translated_caption) && !latestTranslation?.committed_translated_caption;
  const latestProviderRoute =
    getLatestProviderRoute(live.spans) ?? "openrouter:configured-worker-route";
  const latestSourceCaption =
    live.tentative_source_caption ||
    live.spans[live.spans.length - 1]?.source_caption ||
    "";
  const continuousPendingCount = live.spans.filter((span) =>
    span.status === "translating" || Boolean(span.partial_translated_caption && !span.committed_translated_caption),
  ).length;
  const hasContinuousTimeline = live.spans.length > 0 || Boolean(live.tentative_source_caption.trim());
  const canChangeLanguages = canStartSession(live.status);
  const canStart =
    canStartSession(live.status) &&
    (sourceLanguageCode === autoSourceLanguageCode || sourceLanguageCode !== targetLanguageCode);
  const canSwapLanguages = canChangeLanguages && sourceLanguageCode !== autoSourceLanguageCode;
  const isLive = live.status === "live";
  const healthText = getHealthText(live.status, live.error);
  const hasTranslatedText = Boolean(latestTranslationText.trim());
  const hasSourceText = Boolean(latestSourceCaption.trim());
  const primaryCanvasText = hasTranslatedText
    ? latestTranslationText
    : isLive
      ? "Listening"
      : live.error === "microphone_permission_denied"
        ? "Microphone access needed"
        : "Ready to translate";
  const secondaryCanvasText = hasSourceText
    ? latestSourceCaption
    : isLive
      ? "Speak now. Captions will appear here."
      : live.error === "microphone_permission_denied"
      ? "Allow microphone access to start listening."
      : "Choose a direction, then tap Listen.";
  const statusText = useMemo(() => getStatusText(live.status, live.error), [live.error, live.status]);
  const statusDotStyle = [
    styles.statusDot,
    live.status === "live" && styles.statusDotLive,
    live.status === "recovering" && styles.statusDotRecovering,
    live.status === "network_degraded" && styles.statusDotDegraded,
    live.status === "transport_disconnected" && styles.statusDotDisconnected,
  ];
  const continuousAutoScrollKey = live.spans
    .map((span) => [
      span.span_id,
      span.status,
      span.partial_translated_caption?.length ?? 0,
      span.committed_translated_caption?.length ?? 0,
    ].join(":"))
    .join("|");

  useEffect(() => {
    if (translationMode === "continuous" && canStartSession(live.status)) {
      continuousAutoScrollRef.current = true;
      continuousUserInteractedRef.current = false;
    }
  }, [live.status, translationMode]);

  useEffect(() => {
    if (translationMode !== "continuous") {
      return;
    }
    if (!continuousAutoScrollRef.current && continuousUserInteractedRef.current) {
      return;
    }
    const timeout = setTimeout(() => {
      continuousTimelineRef.current?.scrollToEnd({ animated: true });
    }, 80);
    return () => clearTimeout(timeout);
  }, [continuousAutoScrollKey, live.tentative_source_caption, translationMode]);

  async function acceptThirdPartyDataSharing(): Promise<void> {
    await acknowledgePrivacyDisclosure();
    setPrivacyAcknowledged(true);
    setPrivacyConsentChecked(false);
    setOnboardingStep("languages");
  }

  async function startAfterOnboarding(): Promise<void> {
    if (!privacyAcknowledged) {
      setPrivacyConsentChecked(false);
      setOnboardingStep("privacy");
      return;
    }
    setOnboardingStep("done");
    await live.start();
  }

  async function handlePrimaryAction(): Promise<void> {
    if (isLive) {
      await live.stop();
      return;
    }
    if (canStart) {
      if (!privacyAcknowledged) {
        setPrivacyConsentChecked(false);
        setOnboardingStep("privacy");
        return;
      }
      await live.start();
    }
  }

  if (onboardingStep !== "done") {
    return (
      <SafeAreaView style={styles.screen}>
        <Onboarding
          canStart={canStart}
          onContinue={() => setOnboardingStep("privacy")}
          onOpenPicker={setPickerMode}
          onPrivacyAgree={() => void acceptThirdPartyDataSharing()}
          onStart={() => void startAfterOnboarding()}
          onTogglePrivacyConsent={() => setPrivacyConsentChecked((checked) => !checked)}
          privacyConsentChecked={privacyConsentChecked}
          sourceLanguage={sourceLanguageDisplayName}
          step={onboardingStep}
          targetLanguage={targetLanguage.display_name}
        />
        <LanguagePickerModal
          disabledLanguage={
            pickerMode === "source"
              ? targetLanguageCode
              : sourceLanguageCode === autoSourceLanguageCode
                ? undefined
                : sourceLanguageCode
          }
          mode={pickerMode}
          onClose={() => setPickerMode(null)}
          onSelect={(language) => {
            if (pickerMode === "source") {
              setSourceLanguageCode(language);
            } else {
              setTargetLanguageCode(language === autoSourceLanguageCode ? targetLanguageCode : language);
            }
            setPickerMode(null);
          }}
          selected={pickerMode === "source" ? sourceLanguageCode : targetLanguageCode}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.appChrome}>
        <Pressable
          accessibilityLabel="Open settings"
          accessibilityRole="button"
          onPress={() => setSettingsOpen(true)}
          style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
        >
          <Text style={styles.iconButtonText}>...</Text>
        </Pressable>
        <View
          accessible
          accessibilityLabel={`Murmur health ${healthText}`}
          accessibilityRole="text"
          style={styles.brandMini}
        >
          <View style={statusDotStyle} />
          <Image accessibilityIgnoresInvertColors source={brandLogo} style={styles.brandMiniLogo} />
          <Text style={styles.brandMiniText}>Murmur</Text>
          <Text style={styles.healthText}>{healthText}</Text>
        </View>
        <View
          accessible
          accessibilityLabel={`Speech playback ${audioState?.playback_active ? "on" : "off"}`}
          accessibilityRole="text"
          style={[styles.iconButton, styles.speechIndicator]}
        >
          <Text style={styles.iconButtonText}>{audioState?.playback_active ? "On" : "Audio"}</Text>
        </View>
      </View>

      <View style={styles.languageStrip}>
        <View style={styles.languagePill}>
          <Pressable
            accessibilityRole="button"
            disabled={!canChangeLanguages}
            onPress={() => setPickerMode("source")}
            style={({ pressed }) => [styles.languagePillSide, pressed && styles.pressed]}
          >
            <Text style={styles.languagePillText} numberOfLines={1}>
              {sourceLanguageDisplayName}
            </Text>
          </Pressable>
          <Pressable
            accessibilityLabel="Reverse translation languages"
            accessibilityRole="button"
            disabled={!canSwapLanguages}
            onPress={() => {
              if (sourceLanguageCode === autoSourceLanguageCode) {
                return;
              }
              setSourceLanguageCode(targetLanguageCode);
              setTargetLanguageCode(sourceLanguageCode);
            }}
            style={({ pressed }) => [
              styles.languageSwapButton,
              (pressed || !canSwapLanguages) && styles.pressed,
            ]}
          >
            <Text style={styles.languageSwapText}>{"<->"}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={!canChangeLanguages}
            onPress={() => setPickerMode("target")}
            style={({ pressed }) => [styles.languagePillSide, pressed && styles.pressed]}
          >
            <Text style={styles.languagePillText} numberOfLines={1}>
              {targetLanguage.display_name}
            </Text>
          </Pressable>
        </View>
      </View>

      <View
        accessibilityLabel={`Translation mode ${translationMode === "continuous" ? "Continuous" : "Phrase"}`}
        accessibilityRole="tablist"
        style={styles.modeToggle}
      >
        {(["phrase", "continuous"] as const).map((mode) => {
          const active = translationMode === mode;
          return (
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: active, disabled: !canChangeLanguages }}
              disabled={!canChangeLanguages}
              key={mode}
              onPress={() => setTranslationMode(mode)}
              style={({ pressed }) => [
                styles.modeButton,
                active && styles.modeButtonActive,
                (pressed || !canChangeLanguages) && styles.pressed,
              ]}
            >
              <Text style={[styles.modeButtonText, active && styles.modeButtonTextActive]}>
                {mode === "continuous" ? "Continuous" : "Phrase"}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.translationSurface}>
        {translationMode === "continuous" ? (
          <ScrollView
            contentContainerStyle={styles.continuousContent}
            onContentSizeChange={() => {
              if (continuousAutoScrollRef.current || !continuousUserInteractedRef.current) {
                continuousTimelineRef.current?.scrollToEnd({ animated: true });
              }
            }}
            onScroll={({ nativeEvent }) => {
              if (!continuousUserInteractedRef.current) {
                return;
              }
              const distanceFromBottom =
                nativeEvent.contentSize.height -
                nativeEvent.layoutMeasurement.height -
                nativeEvent.contentOffset.y;
              continuousAutoScrollRef.current = distanceFromBottom < 160;
            }}
            onScrollBeginDrag={() => {
              continuousUserInteractedRef.current = true;
            }}
            ref={continuousTimelineRef}
            scrollEventThrottle={80}
            showsVerticalScrollIndicator
          >
            <View style={styles.continuousHeader}>
              <Text style={styles.translationKicker}>Live translation timeline</Text>
              <Text style={styles.continuousStatus}>
                {continuousPendingCount > 0
                  ? `${continuousPendingCount} pending`
                  : isLive
                    ? "Live"
                    : statusText}
              </Text>
            </View>

            <View style={styles.continuousTimeline}>
              {!hasContinuousTimeline ? (
                <Text style={styles.continuousEmpty}>
                  {isLive ? "Listening. Captions will persist here." : "Tap Listen to start a continuous timeline."}
                </Text>
              ) : null}
              {live.spans.map((span) => (
                <ContinuousTimelineRow
                  key={`${span.span_id}:${span.revision}`}
                  sourceLanguageRtl={Boolean(sourceLanguage?.rtl)}
                  span={span}
                  targetLanguageRtl={targetLanguage.rtl}
                />
              ))}
              {live.tentative_source_caption.trim() ? (
                <View style={[styles.spanRow, styles.continuousSourcePanel]}>
                  <Text style={[styles.spanTranslation, styles.translatedTextPartial]}>
                    Listening...
                  </Text>
                  <Text style={[styles.spanSource, sourceLanguage?.rtl && styles.rtlText]}>
                    {live.tentative_source_caption}
                  </Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.continuousFooterText}>
              Committed captions stay in this session timeline. Current partials are muted until committed.
            </Text>
          </ScrollView>
        ) : (
          <ScrollView
            contentContainerStyle={styles.translationContent}
            showsVerticalScrollIndicator={false}
          >
            {!hasTranslatedText ? (
              <View style={styles.translationEmptyArt}>
                <View style={styles.translationEmptyHalo} />
                <Image accessibilityIgnoresInvertColors source={brandLogo} style={styles.translationEmptyLogo} />
              </View>
            ) : null}
            <Text style={styles.translationKicker}>
              {hasTranslatedText ? "Translated captions" : statusText}
            </Text>
            <Text
              numberOfLines={8}
              style={[
                styles.translatedText,
                !hasTranslatedText && styles.emptyTranslatedText,
                latestTranslationIsPartial && styles.translatedTextPartial,
                hasTranslatedText && targetLanguage.rtl && styles.rtlText,
              ]}
            >
              {primaryCanvasText}
            </Text>
            <Text
              numberOfLines={5}
              style={[styles.sourceText, hasSourceText && sourceLanguage?.rtl && styles.rtlText]}
            >
              {secondaryCanvasText}
            </Text>
          </ScrollView>
        )}
      </View>

      <View style={styles.bottomDock}>
        {live.error && live.error !== "microphone_permission_denied" ? (
          <Text style={styles.error}>{formatLiveError(live.error)}</Text>
        ) : null}
        {live.report_error ? <Text style={styles.error}>{formatReportError(live.report_error)}</Text> : null}
        {live.report_receipt_id ? (
          <Text style={styles.receipt}>Report received: {live.report_receipt_id.slice(0, 8)}</Text>
        ) : null}
        <Text style={styles.listenHint}>
          {isLive ? "Listening for speech" : "Microphone stays off until you tap Listen."}
        </Text>
        <Pressable
          accessibilityRole="button"
          disabled={!isLive && !canStart}
          onPress={() => void handlePrimaryAction()}
          style={({ pressed }) => [
            styles.listenButton,
            isLive && styles.stopButton,
            (pressed || (!isLive && !canStart)) && styles.pressed,
          ]}
        >
          <Text style={styles.listenButtonText}>{isLive ? "Stop" : "Listen"}</Text>
        </Pressable>
      </View>

      <LanguagePickerModal
        disabledLanguage={
          pickerMode === "source"
            ? targetLanguageCode
            : sourceLanguageCode === autoSourceLanguageCode
              ? undefined
              : sourceLanguageCode
        }
        mode={pickerMode}
        onClose={() => setPickerMode(null)}
        onSelect={(language) => {
          if (pickerMode === "source") {
            setSourceLanguageCode(language);
          } else {
            setTargetLanguageCode(language === autoSourceLanguageCode ? targetLanguageCode : language);
          }
          setPickerMode(null);
        }}
        selected={pickerMode === "source" ? sourceLanguageCode : targetLanguageCode}
      />
      <SettingsModal
        audioState={audioState}
        latestProviderRoute={latestProviderRoute}
        live={live}
        networkType={networkType}
        onClose={() => setSettingsOpen(false)}
        onDeleteLocalData={() => void deleteLocalData(setSettingsMessage, live.cancel, () => {
          setPrivacyAcknowledged(false);
          setPrivacyConsentChecked(false);
        })}
        onOpenDiagnostics={() => setDiagnosticsOpen(true)}
        onResetIdentity={() => void resetIdentity(setSettingsMessage)}
        open={settingsOpen}
        settingsMessage={settingsMessage}
        sourceLanguageCode={sourceLanguageCode}
        targetLanguageCode={targetLanguageCode}
      />
      <DiagnosticsModal
        audioState={audioState}
        latestProviderRoute={latestProviderRoute}
        live={live}
        networkType={networkType}
        onClose={() => setDiagnosticsOpen(false)}
        open={diagnosticsOpen}
        sourceLanguageCode={sourceLanguageCode}
        targetLanguage={targetLanguage}
        targetLanguageCode={targetLanguageCode}
      />
    </SafeAreaView>
  );
}

function Onboarding({
  canStart,
  onContinue,
  onOpenPicker,
  onPrivacyAgree,
  onStart,
  onTogglePrivacyConsent,
  privacyConsentChecked,
  sourceLanguage,
  step,
  targetLanguage,
}: {
  canStart: boolean;
  onContinue: () => void;
  onOpenPicker: (mode: PickerMode) => void;
  onPrivacyAgree: () => void;
  onStart: () => void;
  onTogglePrivacyConsent: () => void;
  privacyConsentChecked: boolean;
  sourceLanguage: string;
  step: OnboardingStep;
  targetLanguage: string;
}): ReactNode {
  if (step === "welcome") {
    return (
      <ScrollView
        alwaysBounceVertical={false}
        contentContainerStyle={styles.onboardingScroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.onboardingHeader}>
          <View style={styles.brandMark}>
            <Image accessibilityIgnoresInvertColors source={brandLogo} style={styles.brandLogo} />
          </View>
          <Text style={styles.brand}>Murmur</Text>
        </View>
        <View style={styles.welcomeHero}>
          <View style={styles.heroGlowOne} />
          <View style={styles.heroGlowTwo} />
          <View style={styles.previewHeader}>
            <Text style={styles.previewLanguage}>English</Text>
            <Text style={styles.previewArrow}>-&gt;</Text>
            <Text style={styles.previewLanguage}>Arabic</Text>
          </View>
          <Text style={styles.previewTranslation}>أين محطة القطار؟</Text>
          <Text style={styles.previewSource}>Where is the train station?</Text>
          <View style={styles.previewMeter}>
            <View style={[styles.previewMeterBar, styles.previewMeterBarShort]} />
            <View style={styles.previewMeterBar} />
            <View style={[styles.previewMeterBar, styles.previewMeterBarTall]} />
            <View style={styles.previewMeterBar} />
            <View style={[styles.previewMeterBar, styles.previewMeterBarShort]} />
          </View>
        </View>
        <View style={styles.onboardingBody}>
          <Text style={styles.onboardingTitle}>Translate speech as it happens.</Text>
          <Text style={styles.onboardingCopy}>
            Choose a direction, listen, and read clear captions in real time.
          </Text>
        </View>
        <View style={styles.onboardingFooter}>
          <Pressable accessibilityRole="button" onPress={onContinue} style={styles.onboardingButton}>
            <Text style={styles.onboardingButtonText}>Continue</Text>
          </Pressable>
        </View>
      </ScrollView>
    );
  }

  if (step === "privacy") {
    return (
      <ScrollView
        alwaysBounceVertical={false}
        contentContainerStyle={styles.onboardingScroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.onboardingHeader}>
          <View style={styles.brandMark}>
            <Image accessibilityIgnoresInvertColors source={brandLogo} style={styles.brandLogo} />
          </View>
          <Text style={styles.brand}>Murmur</Text>
        </View>
        <View style={styles.privacyHero}>
          <View style={styles.privacyMic}>
            <View style={styles.privacyMicCapsule} />
            <View style={styles.privacyMicStem} />
          </View>
          <View style={styles.privacyPulseOuter} />
          <View style={styles.privacyPulseInner} />
          <Text style={styles.privacyHeroTitle}>AI processing notice</Text>
          <Text style={styles.privacyHeroCopy}>
            When you tap Listen, Murmur sends live audio to Deepgram, captions to OpenRouter
            through Q9 Labs on Cloudflare, and translated text to Cartesia for speech.
          </Text>
          <View style={styles.privacyDetails}>
            <Text style={styles.privacyDetailText}>
              Murmur uses this data only to provide translation, speech output, safety reports,
              diagnostics, and abuse prevention.
            </Text>
            <Text style={styles.privacyDetailText}>
              Murmur does not save audio or transcript history by default.
            </Text>
          </View>
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: privacyConsentChecked }}
            onPress={onTogglePrivacyConsent}
            style={styles.privacyConsentRow}
          >
            <View style={[styles.privacyCheckbox, privacyConsentChecked && styles.privacyCheckboxChecked]}>
              <Text style={styles.privacyCheckboxMark}>{privacyConsentChecked ? "✓" : ""}</Text>
            </View>
            <Text style={styles.privacyConsentText}>
              I agree to share this data with these services for live AI translation.
            </Text>
          </Pressable>
        </View>
        <View style={styles.onboardingFooter}>
          <Pressable
            accessibilityRole="button"
            disabled={!privacyConsentChecked}
            onPress={onPrivacyAgree}
            style={[styles.onboardingButton, !privacyConsentChecked && styles.pressed]}
          >
            <Text style={styles.onboardingButtonText}>Agree and Continue</Text>
          </Pressable>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      alwaysBounceVertical={false}
      contentContainerStyle={styles.onboardingScroll}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.onboardingHeader}>
        <View style={styles.brandMark}>
          <Image accessibilityIgnoresInvertColors source={brandLogo} style={styles.brandLogo} />
        </View>
        <Text style={styles.brand}>Murmur</Text>
      </View>
      <View style={styles.onboardingCenter}>
        <View style={styles.setupHero}>
          <Text style={styles.onboardingEyebrow}>First setup</Text>
          <Text style={styles.setupTitle}>Translation direction</Text>
          <View style={styles.setupRows}>
            <SetupButton label="I will speak" value={sourceLanguage} onPress={() => onOpenPicker("source")} />
            <View style={styles.setupConnector}>
              <Text style={styles.setupConnectorText}>-&gt;</Text>
            </View>
            <SetupButton label="Translate into" value={targetLanguage} onPress={() => onOpenPicker("target")} />
          </View>
        </View>
      </View>
      <View style={styles.onboardingFooter}>
        <Pressable
          accessibilityRole="button"
          disabled={!canStart}
          onPress={onStart}
          style={[styles.onboardingButton, !canStart && styles.pressed]}
        >
          <Text style={styles.onboardingButtonText}>Listen</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function SetupButton({
  label,
  onPress,
  value,
}: {
  label: string;
  onPress: () => void;
  value: string;
}): ReactNode {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.setupButton}>
      <Text style={styles.setupLabel}>{label}</Text>
      <Text style={styles.setupValue}>{value}</Text>
    </Pressable>
  );
}

function LanguagePickerModal({
  disabledLanguage,
  mode,
  onClose,
  onSelect,
  selected,
}: {
  disabledLanguage?: LanguageCode;
  mode: PickerMode;
  onClose: () => void;
  onSelect: (language: SourceLanguageCode) => void;
  selected: SourceLanguageCode;
}): ReactNode {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const filteredLanguages = languageRegistry.filter((language) => {
    const haystack = `${language.display_name} ${language.native_name} ${language.openrouter_label}`.toLowerCase();
    return haystack.includes(normalizedQuery);
  });
  const showAutoDetect =
    mode === "source" && `auto detect automatic source language`.includes(normalizedQuery);

  useEffect(() => {
    if (mode) {
      setQuery("");
    }
  }, [mode]);

  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={mode !== null}>
      <View style={styles.modalScrim}>
        <SafeAreaView style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{mode === "source" ? "I will speak" : "Translate into"}</Text>
            <Pressable accessibilityRole="button" onPress={onClose} style={styles.sheetDone}>
              <Text style={styles.sheetDoneText}>Done</Text>
            </Pressable>
          </View>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={setQuery}
            placeholder="Search languages"
            placeholderTextColor="#8E8A82"
            style={styles.searchInput}
            value={query}
          />
          <ScrollView contentContainerStyle={styles.languageList}>
            {showAutoDetect ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => onSelect(autoSourceLanguageCode)}
                style={({ pressed }) => [
                  styles.languageOption,
                  selected === autoSourceLanguageCode && styles.languageOptionSelected,
                  pressed && styles.pressed,
                ]}
              >
                <View>
                  <Text style={styles.languageOptionName}>Auto detect</Text>
                  <Text style={styles.languageOptionNative}>Live multilingual source</Text>
                </View>
                <Text style={styles.languageOptionCheck}>
                  {selected === autoSourceLanguageCode ? "Selected" : ""}
                </Text>
              </Pressable>
            ) : null}
            {filteredLanguages.map((language) => {
              const isSelected = language.app_code === selected;
              const isDisabled = language.app_code === disabledLanguage;
              return (
                <Pressable
                  accessibilityRole="button"
                  disabled={isDisabled}
                  key={language.app_code}
                  onPress={() => onSelect(language.app_code)}
                  style={({ pressed }) => [
                    styles.languageOption,
                    isSelected && styles.languageOptionSelected,
                    (pressed || isDisabled) && styles.pressed,
                  ]}
                >
                  <View>
                    <Text style={styles.languageOptionName}>{language.display_name}</Text>
                    <Text style={styles.languageOptionNative}>{language.native_name}</Text>
                  </View>
                  <Text style={styles.languageOptionCheck}>{isSelected ? "Selected" : ""}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

function SettingsModal({
  live,
  onClose,
  onDeleteLocalData,
  onOpenDiagnostics,
  onResetIdentity,
  open,
  settingsMessage,
}: {
  audioState: AudioStateEvent | null;
  latestProviderRoute: string;
  live: ReturnType<typeof useLiveTranslation>;
  networkType: string;
  onClose: () => void;
  onDeleteLocalData: () => void;
  onOpenDiagnostics: () => void;
  onResetIdentity: () => void;
  open: boolean;
  settingsMessage: string | null;
  sourceLanguageCode: SourceLanguageCode;
  targetLanguageCode: LanguageCode;
}): ReactNode {
  const disabled = live.status === "live";
  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={open}>
      <View style={styles.modalScrim}>
        <SafeAreaView style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Settings</Text>
            <Pressable accessibilityRole="button" onPress={onClose} style={styles.sheetDone}>
              <Text style={styles.sheetDoneText}>Done</Text>
            </Pressable>
          </View>
          <View style={styles.settingsList}>
            <SettingsAction label="Session diagnostics" onPress={onOpenDiagnostics} />
            <SettingsAction disabled={disabled} label="Reset accountless identity" onPress={onResetIdentity} />
            <SettingsAction disabled={disabled} label="Delete local data" onPress={onDeleteLocalData} />
          </View>
          {settingsMessage ? <Text style={styles.settingsMessage}>{settingsMessage}</Text> : null}
        </SafeAreaView>
      </View>
    </Modal>
  );
}

function SettingsAction({
  disabled,
  label,
  onPress,
}: {
  disabled?: boolean;
  label: string;
  onPress: () => void;
}): ReactNode {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.settingsAction, (pressed || disabled) && styles.pressed]}
    >
      <Text style={styles.settingsActionText}>{label}</Text>
      <Text style={styles.settingsChevron}>{">"}</Text>
    </Pressable>
  );
}

function DiagnosticsModal({
  audioState,
  latestProviderRoute,
  live,
  networkType,
  onClose,
  open,
  sourceLanguageCode,
  targetLanguage,
  targetLanguageCode,
}: {
  audioState: AudioStateEvent | null;
  latestProviderRoute: string;
  live: ReturnType<typeof useLiveTranslation>;
  networkType: string;
  onClose: () => void;
  open: boolean;
  sourceLanguageCode: SourceLanguageCode;
  targetLanguage: ReturnType<typeof getLanguage>;
  targetLanguageCode: LanguageCode;
}): ReactNode {
  const [diagnosticsMessage, setDiagnosticsMessage] = useState<string | null>(null);
  const reportParams = {
    appSessionId: live.session.identity.app_session_id,
    networkType,
    providerRoute: latestProviderRoute,
    debugLog: live.debug_log,
    samples: live.latency_samples,
    sourceLanguage: sourceLanguageCode,
    targetLanguage: targetLanguageCode,
  };
  const hasReport = live.latency_samples.length > 0;

  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={open}>
      <View style={styles.modalScrim}>
        <SafeAreaView style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Diagnostics</Text>
            <Pressable accessibilityRole="button" onPress={onClose} style={styles.sheetDone}>
              <Text style={styles.sheetDoneText}>Done</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.diagnosticsContent}>
            <View style={styles.metricsRow}>
              <Metric label="Session" value={live.status} />
              <Metric label="Spans" value={String(live.spans.length)} />
              <Metric label="Mic" value={audioState?.capture_active ? "on" : "off"} />
              <Metric label="Speech" value={audioState?.playback_active ? "on" : "off"} />
            </View>
            <LatencyRow label="Session setup" value={formatLatencyPercentiles(live.latency_report.session_create)} />
            <LatencyRow label="Mic start" value={formatLatencyPercentiles(live.latency_report.mic_capture_started)} />
            <LatencyRow
              label="STT interim"
              value={formatLatencyPercentiles(live.latency_report.deepgram_interim_received)}
            />
            <LatencyRow label="STT final" value={formatLatencyPercentiles(live.latency_report.deepgram_final_received)} />
            <LatencyRow
              label="First token"
              value={formatLatencyPercentiles(live.latency_report.first_translated_token_returned)}
            />
            <LatencyRow
              label="Translation done"
              value={formatLatencyPercentiles(live.latency_report.translation_done)}
            />
            <LatencyRow
              label="Speech queued"
              value={formatLatencyPercentiles(live.latency_report.stable_phrase_sent_to_cartesia)}
            />
            <View style={styles.diagnosticActions}>
              <Pressable
                accessibilityRole="button"
                disabled={!hasReport}
                onPress={() =>
                  void copyDiagnosticsReport(reportParams).then(() => {
                    setDiagnosticsMessage("Diagnostics copied.");
                  })
                }
                style={[styles.diagnosticButton, !hasReport && styles.pressed]}
              >
                <Text style={styles.diagnosticButtonText}>Copy report</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={!hasReport}
                onPress={() =>
                  void downloadDiagnosticsReport(reportParams).then((downloaded) => {
                    setDiagnosticsMessage(downloaded ? "Diagnostics downloaded." : "Download is available on web.");
                  })
                }
                style={[styles.diagnosticButtonSecondary, !hasReport && styles.pressed]}
              >
                <Text style={styles.diagnosticButtonTextSecondary}>Download .txt</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={!hasReport}
                onPress={() => void shareLatencyReport(reportParams)}
                style={[styles.diagnosticButtonSecondary, !hasReport && styles.pressed]}
              >
                <Text style={styles.diagnosticButtonTextSecondary}>Share</Text>
              </Pressable>
            </View>
            {diagnosticsMessage ? <Text style={styles.diagnosticsMessage}>{diagnosticsMessage}</Text> : null}
            <View style={styles.timeline}>
              {live.spans.length === 0 ? (
                <Text style={styles.timelineEmpty}>No spans yet</Text>
              ) : (
                [...live.spans].reverse().map((span) => (
                  <View key={`${span.span_id}-${span.revision}`} style={styles.spanRow}>
                    <Text style={styles.spanSource}>{span.source_caption}</Text>
                    <Text style={[styles.spanTranslation, targetLanguage.rtl && styles.rtlText]}>
                      {span.committed_translated_caption || span.partial_translated_caption || span.status}
                    </Text>
                    {span.status === "committed" ? (
                      <View style={styles.reportRow}>
                        {reportActions.map((action) => (
                          <Pressable
                            accessibilityRole="button"
                            key={action.category}
                            onPress={() => void live.reportSpan(span, action.category)}
                            style={styles.reportButton}
                          >
                            <Text style={styles.reportButtonText}>{action.label}</Text>
                          </Pressable>
                        ))}
                      </View>
                    ) : null}
                  </View>
                ))
              )}
            </View>
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

function buildDiagnosticsReportText(params: DiagnosticsReportParams): string {
  const report = buildLatencyEvidenceReport({
    metadata: {
      app_session_id: params.appSessionId || undefined,
      device_class: Platform.OS === "android" || Platform.OS === "ios" ? "real-device-required" : "unknown",
      network_type: params.networkType,
      platform: Platform.OS,
      provider_route: params.providerRoute,
      source_language: params.sourceLanguage,
      target_language: params.targetLanguage,
    },
    samples: params.samples,
    debugLog: params.debugLog,
  });
  return formatLatencyEvidenceReport(report);
}

async function copyDiagnosticsReport(params: DiagnosticsReportParams): Promise<void> {
  const reportText = buildDiagnosticsReportText(params);
  if (Platform.OS === "web" && globalThis.navigator?.clipboard?.writeText) {
    await globalThis.navigator.clipboard.writeText(reportText);
    return;
  }
  await Share.share({
    message: reportText,
    title: "Murmur diagnostics",
  });
}

async function downloadDiagnosticsReport(params: DiagnosticsReportParams): Promise<boolean> {
  if (Platform.OS !== "web" || typeof document === "undefined") {
    return false;
  }

  const reportText = buildDiagnosticsReportText(params);
  const blob = new Blob([reportText], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `murmur-diagnostics-${new Date().toISOString().replace(/[:.]/g, "-")}.txt`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  return true;
}

async function shareLatencyReport(params: DiagnosticsReportParams): Promise<void> {
  await Share.share({
    message: buildDiagnosticsReportText(params),
    title: "Murmur latency evidence",
  });
}

function getLatestProviderRoute(
  spans: Array<{ provider_metadata: Record<string, unknown> | null }>,
): string | null {
  for (const span of [...spans].reverse()) {
    const metadata = span.provider_metadata;
    if (!metadata) {
      continue;
    }
    const provider = typeof metadata.provider === "string" ? metadata.provider : "provider";
    const upstreamProvider =
      typeof metadata.upstream_provider === "string" ? metadata.upstream_provider : null;
    const upstreamModel =
      typeof metadata.upstream_model === "string" ? metadata.upstream_model : null;
    if (upstreamProvider || upstreamModel) {
      return [provider, upstreamProvider, upstreamModel].filter(Boolean).join(":");
    }
  }
  return null;
}

function getStatusText(status: string, error: string | null): string {
  if (status === "recovering") {
    return "Recovering";
  }
  if (status === "network_degraded") {
    return "Network degraded";
  }
  if (status === "transport_disconnected") {
    return "Disconnected";
  }
  if (error) {
    if (error.startsWith("speech_unavailable")) {
      return "Speech unavailable";
    }
    if (error === "translation_transport_reconnecting" || error.startsWith("provider_token_refresh_retrying")) {
      return "Recovering";
    }
    if (error === "translation_transport_error") {
      return "Network degraded";
    }
    return "Needs setup";
  }
  if (status === "live") {
    return "Health OK";
  }
  if (status === "ended") {
    return "Ended";
  }
  if (status === "creating_session" || status.startsWith("connecting")) {
    return "Connecting";
  }
  if (status === "requesting_mic_permission") {
    return "Microphone";
  }
  return "Ready";
}

function getHealthText(status: string, error: string | null): string {
  if (error === "translation_transport_reconnecting" || error?.startsWith("provider_token_refresh_retrying")) {
    return "Recovering";
  }
  if (error === "translation_transport_error" || status === "network_degraded") {
    return "Degraded";
  }
  if (status === "recovering") {
    return "Recovering";
  }
  if (status === "transport_disconnected") {
    return "Disconnected";
  }
  if (status === "live") {
    return "OK";
  }
  if (status === "connecting_deepgram" || status === "connecting_translate_ws" || status === "creating_session") {
    return "Connecting";
  }
  return "Ready";
}

async function resetIdentity(setMessage: (message: string | null) => void): Promise<void> {
  await resetInstallId();
  setMessage("Accountless identity reset. The next session will use a fresh install id.");
}

async function deleteLocalData(
  setMessage: (message: string | null) => void,
  cancel: () => Promise<void>,
  onDeleted?: () => void,
): Promise<void> {
  await cancel();
  await deleteLocalMurmurData();
  onDeleted?.();
  setMessage("Local Murmur data deleted. Privacy acknowledgement and install id were cleared.");
}

function formatLiveError(error: string): string {
  if (error.startsWith("provider_unconfigured")) {
    return "Live translation is not connected yet. Please try again after setup is complete.";
  }
  if (error.startsWith("provider_unavailable:deepgram")) {
    return "Speech recognition is not connected yet. Please try again after setup is complete.";
  }
  if (error.startsWith("provider_unavailable")) {
    return "Live translation provider is unavailable. Please try again.";
  }
  if (error === "worker_session_network_error" || error.startsWith("worker_session_http_")) {
    return "Could not reach Murmur translation service. Check your connection and try again.";
  }
  if (error === "microphone_permission_denied") {
    return "Microphone access is required to translate speech.";
  }
  if (error === "microphone_start_failed") {
    return "Could not start the microphone. Please try again.";
  }
  if (error.startsWith("speech_unavailable")) {
    return `Speech unavailable. Translated captions can continue. (${error})`;
  }
  if (error === "translation_transport_error") {
    return `Translation connection was interrupted. Please try again. (${error})`;
  }
  if (error === "translation_transport_reconnecting") {
    return `Translation connection is reconnecting. Captions will continue shortly. (${error})`;
  }
  if (error.startsWith("provider_token_refresh_retrying")) {
    return `Provider session is refreshing. Captions will continue shortly. (${error})`;
  }
  if (error.startsWith("deepgram:")) {
    return `Speech recognition connection failed. Please try again. (${error})`;
  }
  return `Live translation is unavailable. Please try again. (${error})`;
}

function formatReportError(error: string): string {
  if (error === "report_rate_limited") {
    return "Too many reports were sent from this session. Please try again later.";
  }
  return "Could not send the report. Please try again.";
}

function Metric({ label, value }: { label: string; value: string }): ReactNode {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function ContinuousTimelineRow({
  sourceLanguageRtl,
  span,
  targetLanguageRtl,
}: {
  sourceLanguageRtl: boolean;
  span: TranslationSpan;
  targetLanguageRtl: boolean;
}): ReactNode {
  if (span.status === "superseded" && !span.committed_translated_caption && !span.partial_translated_caption) {
    return null;
  }
  const translationText =
    span.committed_translated_caption ||
    span.partial_translated_caption ||
    (span.status === "failed" ? "Translation failed" : "Translating...");
  const translationIsPartial =
    Boolean(span.partial_translated_caption && !span.committed_translated_caption) ||
    span.status === "translating";

  return (
    <View style={styles.spanRow}>
      <Text
        style={[
          styles.spanTranslation,
          translationIsPartial && styles.translatedTextPartial,
          targetLanguageRtl && styles.rtlText,
        ]}
      >
        {translationText}
      </Text>
      <Text style={[styles.spanSource, sourceLanguageRtl && styles.rtlText]}>
        {span.source_caption}
      </Text>
    </View>
  );
}

function LatencyRow({ label, value }: { label: string; value: string }): ReactNode {
  return (
    <View style={styles.latencyRow}>
      <Text style={styles.latencyLabel}>{label}</Text>
      <Text style={styles.latencyValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create<AppStyles>({
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
  continuousContent: {
    flexGrow: 1,
    gap: 12,
    justifyContent: "flex-start",
    paddingBottom: 28,
    paddingHorizontal: 24,
    paddingTop: 18,
  },
  continuousEmpty: {
    color: "#6B7B72",
    fontSize: 17,
    fontWeight: "700",
    lineHeight: 24,
    paddingVertical: 28,
  },
  continuousFooterText: {
    color: "#7A827D",
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17,
    paddingBottom: 6,
  },
  continuousHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  continuousSourcePanel: {
    borderBottomWidth: 0,
    opacity: 0.72,
  },
  continuousStatus: {
    color: "#5F6A64",
    fontSize: 12,
    fontWeight: "900",
  },
  continuousTimeline: {
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
