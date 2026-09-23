import * as Linking from "expo-linking";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Network from "expo-network";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { ScrollView } from "react-native";

import {
  autoSourceLanguageCode,
  type LanguageCode,
  type SourceLanguageCode,
} from "@murmur/protocol/languages";
import { canStartSession } from "@murmur/protocol/session";

import MurmurAudioModule, {
  type AudioCaptureSource,
  type AudioStateEvent,
  type CaptureCapabilities,
} from "../../modules/murmur-audio";
import { getAcquisitionContextFromUrl } from "../lib/acquisition";
import { deleteEngagementState } from "../lib/engagement";
import {
  acknowledgePrivacyDisclosure,
  deleteLocalMurmurData,
  hasAcknowledgedPrivacyDisclosure,
  resetInstallId,
} from "../lib/installIdentity";
import { claimRatingSlot, deleteRatingState, type SessionRatingDecision } from "../lib/ratings/ratings";
import {
  deletePhoneAudioGiftOffer,
  hasOfferedPhoneAudioGift,
  markPhoneAudioGiftOffered,
} from "../lib/phoneAudioGiftOffer";
import { shareMurmur } from "../lib/shareMurmur";
import { captureMobileFailure } from "../lib/observability/sentry";
import {
  captureOnboardingCompleted,
  captureMobileTelemetry,
  initializeAnonymousAnalytics,
  resetAnonymousAnalyticsPreference,
  updateAnonymousAnalyticsEnabled,
} from "../lib/telemetry";
import { hasTimeAvailable } from "../lib/billing/allowance";
import { useMurmurBilling } from "../lib/billing/context";
import { useLiveTranslation } from "../lib/useLiveTranslation";
import { nextPostSessionPrompt, type PostSessionPrompt } from "../screens/postSessionPrompt";
import { RatingSheet } from "../screens/rating/ratingSheet";
import { type ScreenServices, useScreenServices } from "../screens/screenServices";
import {
  type SettingsControls,
  usePublishSettingsControls,
} from "../screens/settings/settingsControls";
import type { OnboardingStep, PickerMode } from "./components";
import {
  deleteStoredAudioPlaybackEnabled,
  getStoredAudioPlaybackEnabled,
  setStoredAudioPlaybackEnabled,
} from "./audioPlaybackPreference";
import { HomeExperience } from "./experience";
import { isLanguagePairReady, normalizeLanguagePair } from "./languageAvailability";
import { OnboardingScreen } from "./onboardingScreen";
import { deleteStoredUiVariant } from "./variants/preference";
import { buildHomeViewModel } from "./viewModel";
import { isAllowanceExhaustedError, isUpdateRequiredError } from "./errorCopy";

const audioPlaybackSaveError = "Could not save the audio setting. Please try again.";
const localDataDeletedMessage =
  "Local Murmur data deleted. Privacy acknowledgement, install id, analytics preference, and rating eligibility were cleared.";
const localDataDeleteError = "Could not delete local data. Please try again.";
const defaultCaptureCapabilities: CaptureCapabilities = {
  device_playback_supported: false,
  floating_overlay_supported: false,
  microphone_supported: true,
  overlay_permission_granted: false,
};

type AudioPlaybackPreferenceController = ReturnType<
  typeof createAudioPlaybackPreferenceController
>;

export function createAudioPlaybackPreferenceController(options: {
  getStored: () => Promise<boolean>;
  onEnabledChange: (enabled: boolean) => void;
  onMessage: (message: string | null) => void;
  setStored: (enabled: boolean) => Promise<void>;
}): {
  deleteLocalData: (operation: () => Promise<void>, onDeleted: () => void) => Promise<void>;
  dispose: () => void;
  restore: () => Promise<void>;
  setEnabled: (enabled: boolean) => Promise<void>;
  waitForRestore: () => Promise<void>;
} {
  let active = true;
  let currentEnabled = true;
  let persistedEnabled = true;
  let userInteracted = false;
  let requestVersion = 0;
  let restoreVersion = 0;
  let operationQueue = Promise.resolve();
  let restorePromise = Promise.resolve();

  function isCurrent(version: number): boolean {
    return active && requestVersion === version;
  }

  function applyEnabled(enabled: boolean): void {
    currentEnabled = enabled;
    options.onEnabledChange(enabled);
  }

  function enqueue(operation: () => Promise<void>): Promise<void> {
    const next = operationQueue.catch(() => undefined).then(operation);
    operationQueue = next.catch(() => undefined);
    return next;
  }

  function restore(): Promise<void> {
    active = true;
    const version = requestVersion;
    const restoreRequest = ++restoreVersion;
    restorePromise = Promise.resolve()
      .then(() => options.getStored())
      .then((enabled) => {
        if (
          active &&
          restoreVersion === restoreRequest &&
          !userInteracted &&
          requestVersion === version
        ) {
          persistedEnabled = enabled;
          applyEnabled(enabled);
        }
      })
      .catch(() => undefined);
    return restorePromise;
  }

  function setEnabled(enabled: boolean): Promise<void> {
    if (!active) {
      return Promise.resolve();
    }
    userInteracted = true;
    const version = ++requestVersion;
    applyEnabled(enabled);
    options.onMessage(null);
    return enqueue(async () => {
      try {
        await options.setStored(enabled);
        persistedEnabled = enabled;
      } catch {
        if (isCurrent(version) && currentEnabled === enabled) {
          applyEnabled(persistedEnabled);
          options.onMessage(audioPlaybackSaveError);
        }
      }
    }).catch(() => undefined);
  }

  function deleteLocalData(
    operation: () => Promise<void>,
    onDeleted: () => void,
  ): Promise<void> {
    if (!active) {
      return Promise.resolve();
    }
    userInteracted = true;
    const version = ++requestVersion;
    options.onMessage(null);
    return enqueue(async () => {
      await operation();
      persistedEnabled = true;
      if (!isCurrent(version)) {
        return;
      }
      applyEnabled(true);
      onDeleted();
      options.onMessage(localDataDeletedMessage);
    }).catch(() => {
      if (isCurrent(version)) {
        options.onMessage(localDataDeleteError);
      }
    });
  }

  function waitForRestore(): Promise<void> {
    return restorePromise;
  }

  function dispose(): void {
    active = false;
    requestVersion += 1;
    restoreVersion += 1;
  }

  return {
    deleteLocalData,
    dispose,
    restore,
    setEnabled,
    waitForRestore,
  };
}

export default function HomeScreen(): ReactNode {
  const [sourceLanguageCode, setSourceLanguageCode] = useState<SourceLanguageCode>("en");
  const [targetLanguageCode, setTargetLanguageCode] = useState<LanguageCode>("ar");
  const [onboardingStep, setOnboardingStep] = useState<OnboardingStep>("welcome");
  const [privacyAcknowledged, setPrivacyAcknowledged] = useState(false);
  const [privacyConsentChecked, setPrivacyConsentChecked] = useState(false);
  const [pickerMode, setPickerMode] = useState<PickerMode>(null);
  const router = useRouter();
  const services = useScreenServices();
  const { capture } = useLocalSearchParams<{ capture?: string }>();
  const [ratingOpen, setRatingOpen] = useState(false);
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const [outOfMinutesOpen, setOutOfMinutesOpen] = useState(false);
  const [updateRequiredOpen, setUpdateRequiredOpen] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null);
  const [anonymousAnalyticsEnabled, setAnonymousAnalyticsEnabled] = useState<boolean | null>(null);
  const [audioPlaybackEnabled, setAudioPlaybackEnabled] = useState(true);
  const [captureSource, setCaptureSource] = useState<AudioCaptureSource>("microphone");
  const [captureCapabilities, setCaptureCapabilities] = useState(defaultCaptureCapabilities);
  const [audioState, setAudioState] = useState<AudioStateEvent | null>(null);
  const [networkType, setNetworkType] = useState("unknown");
  const timelineRef = useRef<ScrollView | null>(null);
  const autoScrollRef = useRef(true);
  const userInteractedRef = useRef(false);
  const audioPreferenceControllerRef = useRef<AudioPlaybackPreferenceController | null>(null);
  if (!audioPreferenceControllerRef.current) {
    audioPreferenceControllerRef.current = createAudioPlaybackPreferenceController({
      getStored: getStoredAudioPlaybackEnabled,
      onEnabledChange: setAudioPlaybackEnabled,
      onMessage: setSettingsMessage,
      setStored: setStoredAudioPlaybackEnabled,
    });
  }
  const audioPreferenceController = audioPreferenceControllerRef.current;

  const incomingUrl = Linking.useURL();
  const incomingAcquisition = useMemo(
    () => getAcquisitionContextFromUrl(incomingUrl),
    [incomingUrl],
  );
  const [acquisition, setAcquisition] = useState(incomingAcquisition);

  const billing = useMurmurBilling();
  const { enabledLanguages } = billing.config;
  const languagesReady = isLanguagePairReady({
    configLoaded: billing.configLoaded,
    enabledLanguages,
    pair: { source: sourceLanguageCode, target: targetLanguageCode },
  });
  const effectiveAudioPlaybackEnabled = captureSource === "microphone" && audioPlaybackEnabled;
  const live = useLiveTranslation({
    acquisition,
    analytics_enabled: anonymousAnalyticsEnabled === true,
    capture_source: captureSource,
    history_customer_id: billing.customer && (billing.customer.features?.history ?? billing.customer.plan !== "free")
      ? billing.customer.customerId
      : null,
    network_type: networkType,
    playback_enabled: effectiveAudioPlaybackEnabled,
    source_language: sourceLanguageCode,
    target_language: targetLanguageCode,
  });
  const viewModel = useMemo(
    () => buildHomeViewModel({
      captureSource,
      languagePairEnabled: languagesReady,
      live,
      sourceLanguageCode,
      targetLanguageCode,
    }),
    [captureSource, languagesReady, live, sourceLanguageCode, targetLanguageCode],
  );
  const autoScrollKey = useMemo(
    () => live.spans
      .map((span) =>
        `${span.span_id}:${span.status}:${span.source_caption.length}:${span.translated_caption.length}`
      )
      .join("|"),
    [live.spans],
  );

  useEffect(() => {
    if (!canStartSession(live.status)) {
      return;
    }
    const normalized = normalizeLanguagePair(
      { source: sourceLanguageCode, target: targetLanguageCode },
      enabledLanguages,
    );
    if (normalized.source !== sourceLanguageCode) {
      setSourceLanguageCode(normalized.source);
    }
    if (normalized.target !== targetLanguageCode) {
      setTargetLanguageCode(normalized.target);
    }
  }, [enabledLanguages, live.status, sourceLanguageCode, targetLanguageCode]);

  useEffect(() => {
    setAcquisition(incomingAcquisition);
  }, [incomingAcquisition, incomingUrl]);

  const refreshBilling = billing.refresh;
  useEffect(() => {
    if (isAllowanceExhaustedError(live.error)) {
      setOutOfMinutesOpen(true);
      void refreshBilling();
    }
    if (isUpdateRequiredError(live.error)) {
      setUpdateRequiredOpen(true);
    }
  }, [live.error, refreshBilling]);

  useEffect(() => {
    if (live.status === "live" && acquisition) {
      setAcquisition(undefined);
    }
  }, [acquisition, live.status]);

  useEffect(() => {
    if (
      anonymousAnalyticsEnabled !== null &&
      privacyAcknowledged &&
      onboardingStep === "done"
    ) {
      void live.prepare();
    }
  }, [anonymousAnalyticsEnabled, live.prepare, onboardingStep, privacyAcknowledged]);

  useEffect(() => {
    if (anonymousAnalyticsEnabled === true && onboardingStep !== "done") {
      captureMobileTelemetry({ event: "onboarding_step_viewed", step: onboardingStep });
    }
  }, [anonymousAnalyticsEnabled, onboardingStep]);

  useEffect(() => {
    let mounted = true;
    void initializeAnonymousAnalytics()
      .then((enabled) => {
        if (mounted) {
          setAnonymousAnalyticsEnabled(enabled);
        }
      })
      .catch((failure: unknown) => {
        captureMobileFailure(failure, { operation: "initialize_anonymous_analytics" });
        if (mounted) {
          setAnonymousAnalyticsEnabled(false);
        }
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    void hasAcknowledgedPrivacyDisclosure()
      .then((acknowledged) => {
        if (mounted) {
          setPrivacyAcknowledged(acknowledged);
          if (acknowledged) {
            setOnboardingStep("done");
          }
        }
      })
      .catch((failure: unknown) => {
        captureMobileFailure(failure, { operation: "read_privacy_acknowledgement" });
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    void audioPreferenceController.restore();
    return () => audioPreferenceController.dispose();
  }, [audioPreferenceController]);

  useEffect(() => {
    let mounted = true;
    void MurmurAudioModule.getCaptureCapabilities()
      .then((capabilities) => {
        if (mounted) {
          setCaptureCapabilities(capabilities);
        }
      })
      .catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const subscription = MurmurAudioModule.addListener(
      "onAudioState",
      (nextState: AudioStateEvent) => {
        setAudioState((current) => newestAudioState(current, nextState));
      },
    );
    void MurmurAudioModule.getAudioState()
      .then((nextState) => {
        setAudioState((current) => newestAudioState(current, nextState as AudioStateEvent));
      })
      .catch((failure: unknown) => {
        captureMobileFailure(failure, {
          operation: "read_audio_state",
          stage: "audio_capture",
        });
      });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    let mounted = true;
    void Network.getNetworkStateAsync().then((state) => {
      if (mounted) {
        setNetworkType(state.type ?? "unknown");
      }
    }).catch(() => undefined);
    const subscription = Network.addNetworkStateListener((state) => {
      setNetworkType(state.type ?? "unknown");
    });
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (!autoScrollRef.current && userInteractedRef.current) {
      return;
    }
    const timeout = setTimeout(() => {
      timelineRef.current?.scrollToEnd({ animated: true });
    }, 80);
    return () => clearTimeout(timeout);
  }, [autoScrollKey, live.tentative_source_caption]);

  async function acceptThirdPartyDataSharing(): Promise<void> {
    captureMobileTelemetry({ event: "onboarding_step_completed", step: "privacy" });
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
    captureMobileTelemetry({ event: "onboarding_step_completed", step: "languages" });
    captureOnboardingCompleted();
    await startLiveTranslation();
  }

  async function changeAnonymousAnalyticsEnabled(enabled: boolean): Promise<void> {
    setSettingsMessage(null);
    try {
      await updateAnonymousAnalyticsEnabled(enabled);
      setAnonymousAnalyticsEnabled(enabled);
      setSettingsMessage(`Anonymous analytics ${enabled ? "enabled" : "disabled"}.`);
    } catch (failure) {
      captureMobileFailure(failure, { operation: "update_anonymous_analytics" });
      setSettingsMessage("Could not save the analytics setting. Please try again.");
    }
  }

  async function startLiveTranslation(): Promise<void> {
    if (!languagesReady) {
      return;
    }
    if (anonymousAnalyticsEnabled === null) {
      setSettingsMessage("Murmur is still loading your privacy settings. Please try again.");
      return;
    }
    await audioPreferenceController.waitForRestore();
    await live.start();
  }

  async function selectCaptureSource(source: AudioCaptureSource): Promise<void> {
    if (source === "device_playback" && !captureCapabilities.device_playback_supported) {
      return;
    }
    if (source === "device_playback" && !services.features.phoneAudio) {
      router.push("/phone-audio");
      return;
    }
    setCaptureSource(source);
    if (
      source !== "device_playback" ||
      !captureCapabilities.floating_overlay_supported ||
      captureCapabilities.overlay_permission_granted
    ) {
      return;
    }
    const granted = await MurmurAudioModule.requestOverlayPermission().catch(() => false);
    setCaptureCapabilities((current) => ({
      ...current,
      overlay_permission_granted: granted,
    }));
  }

  async function handlePrimaryAction(): Promise<void> {
    if (viewModel.isLive) {
      await live.stop();
      return;
    }
    if (isUpdateRequiredError(live.error)) {
      setUpdateRequiredOpen(true);
      return;
    }
    if (isAllowanceExhaustedError(live.error) && !hasTimeAvailable(billing.customer)) {
      setOutOfMinutesOpen(true);
      return;
    }
    if (!viewModel.canStart) {
      return;
    }
    if (!privacyAcknowledged) {
      setPrivacyConsentChecked(false);
      setOnboardingStep("privacy");
      return;
    }
    await startLiveTranslation();
  }

  // Every completed session brings a new decision; each one gets at most one prompt.
  const ratingDecision = live.rating_decision;
  const handledRatingDecisionRef = useRef<SessionRatingDecision | null>(null);
  const phoneAudioGiftOfferable =
    services.phoneAudioGift.claimable && captureCapabilities.device_playback_supported;
  useEffect(() => {
    if (!ratingDecision || handledRatingDecisionRef.current === ratingDecision) {
      return;
    }
    handledRatingDecisionRef.current = ratingDecision;
    choosePostSessionPrompt({
      decision: ratingDecision,
      insightsConsent: services.insightsConsent,
      phoneAudioGiftOfferable,
    })
      .then(showPostSessionPrompt)
      .catch((failure: unknown) => {
        captureMobileFailure(failure, { operation: "choose_post_session_prompt" });
      });
  }, [phoneAudioGiftOfferable, ratingDecision, services.insightsConsent]);

  function showPostSessionPrompt(prompt: PostSessionPrompt | null): void {
    if (prompt === "insights_consent") {
      router.push("/insights-consent");
    } else if (prompt === "phone_audio_gift") {
      router.push("/phone-audio");
    } else if (prompt === "rating") {
      setRatingOpen(true);
    }
  }

  function swapLanguages(): void {
    if (sourceLanguageCode === autoSourceLanguageCode) {
      return;
    }
    setSourceLanguageCode(targetLanguageCode);
    setTargetLanguageCode(sourceLanguageCode);
  }

  const settingsActionsRef = useRef({
    changeAnalytics: (_enabled: boolean): void => undefined,
    deleteLocalData: (): void => undefined,
    resetIdentity: (): void => undefined,
  });
  settingsActionsRef.current = {
    changeAnalytics: (enabled) => void changeAnonymousAnalyticsEnabled(enabled),
    deleteLocalData: () => {
      void audioPreferenceController.deleteLocalData(
        () => deleteLocalData(live.cancel, services),
        () => {
          live.invalidatePreparation();
          setAnonymousAnalyticsEnabled(true);
          setPrivacyAcknowledged(false);
          setPrivacyConsentChecked(false);
          setCaptureSource("microphone");
        },
      );
    },
    resetIdentity: () => void resetIdentity(live, setSettingsMessage),
  };
  const settingsLocked = live.status === "live";
  const settingsControls = useMemo<SettingsControls>(() => ({
    analyticsEnabled: anonymousAnalyticsEnabled === true,
    changeAnalytics: (enabled) => settingsActionsRef.current.changeAnalytics(enabled),
    deleteLocalData: () => settingsActionsRef.current.deleteLocalData(),
    locked: settingsLocked,
    message: settingsMessage,
    openReport: () => setDiagnosticsOpen(true),
    reportLabel: __DEV__ ? "Session diagnostics" : "Report a translation",
    resetIdentity: () => settingsActionsRef.current.resetIdentity(),
    share: () => void shareMurmur(),
  }), [anonymousAnalyticsEnabled, settingsLocked, settingsMessage]);
  usePublishSettingsControls(settingsControls);

  // The Phone audio screen returns here with ?capture=phone-audio once the listener can use it.
  const phoneAudioAvailable = services.features.phoneAudio;
  useEffect(() => {
    if (capture === "phone-audio" && phoneAudioAvailable) {
      setCaptureSource("device_playback");
      router.setParams({ capture: undefined });
    }
  }, [capture, phoneAudioAvailable, router]);

  if (onboardingStep !== "done") {
    return (
      <OnboardingScreen
        canStart={viewModel.canStart}
        captureSource={captureSource}
        devicePlaybackSupported={captureCapabilities.device_playback_supported}
        onContinue={() => {
          captureMobileTelemetry({ event: "onboarding_step_completed", step: "welcome" });
          setOnboardingStep("privacy");
        }}
        onCaptureSourceChange={(source) => void selectCaptureSource(source)}
        onOpenPicker={setPickerMode}
        onPickerClose={() => setPickerMode(null)}
        onPrivacyAgree={() => void acceptThirdPartyDataSharing()}
        onStart={() => void startAfterOnboarding()}
        onTogglePrivacyConsent={() => setPrivacyConsentChecked((checked) => !checked)}
        pickerMode={pickerMode}
        privacyConsentChecked={privacyConsentChecked}
        setSourceLanguageCode={setSourceLanguageCode}
        setTargetLanguageCode={setTargetLanguageCode}
        sourceLanguageCode={sourceLanguageCode}
        sourceLanguageDisplayName={viewModel.sourceLanguageDisplayName}
        step={onboardingStep}
        targetLanguageCode={targetLanguageCode}
        targetLanguageDisplayName={viewModel.targetLanguage.display_name}
      />
    );
  }

  return (
    <>
      <HomeExperience
        audioPlaybackAvailable={captureSource === "microphone"}
        audioPlaybackEnabled={effectiveAudioPlaybackEnabled}
        audioState={audioState}
        autoScrollRef={autoScrollRef}
        diagnosticsOpen={diagnosticsOpen}
        developerToolsEnabled={__DEV__}
        captureSource={captureSource}
        devicePlaybackSupported={captureCapabilities.device_playback_supported}
        live={live}
        networkType={networkType}
        onCloseDiagnostics={() => setDiagnosticsOpen(false)}
        onClosePicker={() => setPickerMode(null)}
        onCloseOutOfMinutes={() => setOutOfMinutesOpen(false)}
        onCloseUpdateRequired={() => setUpdateRequiredOpen(false)}
        onCaptureSourceChange={(source) => void selectCaptureSource(source)}
        onAudioPlaybackEnabledChange={(enabled) => {
          void audioPreferenceController.setEnabled(enabled);
        }}
        onOpenLowBalance={() => router.push("/plans")}
        onOpenPicker={setPickerMode}
        onOpenSettings={() => router.push("/settings")}
        onPrimaryAction={() => void handlePrimaryAction()}
        onSeePlans={() => {
          setOutOfMinutesOpen(false);
          router.push("/plans");
        }}
        onSwapLanguages={swapLanguages}
        outOfMinutesOpen={outOfMinutesOpen}
        pickerMode={pickerMode}
        setSourceLanguageCode={setSourceLanguageCode}
        setTargetLanguageCode={setTargetLanguageCode}
        sourceLanguageCode={sourceLanguageCode}
        targetLanguageCode={targetLanguageCode}
        timelineRef={timelineRef}
        updateRequiredOpen={updateRequiredOpen}
        userInteractedRef={userInteractedRef}
        viewModel={viewModel}
      />
      <RatingSheet
        onClose={() => setRatingOpen(false)}
        onSubmit={(answer) => {
          setRatingOpen(false);
          services.submitRating(answer).catch((failure: unknown) => {
            captureMobileFailure(failure, { operation: "submit_rating" });
          });
        }}
        open={ratingOpen}
      />
    </>
  );
}

function newestAudioState(
  current: AudioStateEvent | null,
  next: AudioStateEvent,
): AudioStateEvent {
  if (!current) {
    return next;
  }
  const generationOrder = Math.sign(next.audio_generation_id - current.audio_generation_id);
  const eventOrder = Math.sign(next.event_seq - current.event_seq);
  const order = generationOrder || eventOrder;
  return order >= 0 ? next : current;
}

async function resetIdentity(
  live: Pick<ReturnType<typeof useLiveTranslation>, "invalidatePreparation" | "prepare">,
  setMessage: (message: string | null) => void,
): Promise<void> {
  await resetInstallId();
  live.invalidatePreparation();
  await live.prepare();
  setMessage("Local install identity reset. Your billing account and store purchases are unchanged.");
}

async function choosePostSessionPrompt(params: {
  decision: SessionRatingDecision;
  insightsConsent: boolean | null;
  phoneAudioGiftOfferable: boolean;
}): Promise<PostSessionPrompt | null> {
  const prompt = nextPostSessionPrompt({
    askInsightsConsent: params.decision.askInsightsConsent && params.insightsConsent === null,
    offerPhoneAudioGift: params.phoneAudioGiftOfferable && !await hasOfferedPhoneAudioGift(),
    ratingEligible: params.decision.ratingEligible,
  });
  if (prompt === "phone_audio_gift") {
    await markPhoneAudioGiftOffered();
  }
  if (prompt !== "rating") {
    return prompt;
  }
  return await claimRatingSlot() ? "rating" : null;
}

async function deleteLocalData(
  cancel: () => Promise<void>,
  services: Pick<ScreenServices, "clearInsightsConsent" | "reloadConversations">,
): Promise<void> {
  await cancel();
  const { deleteAllConversations } = await import("../lib/conversationHistory");
  deleteAllConversations();
  await services.reloadConversations();
  await deleteLocalMurmurData();
  await deleteStoredAudioPlaybackEnabled();
  await deleteStoredUiVariant();
  await deleteEngagementState();
  await deleteRatingState();
  await services.clearInsightsConsent();
  await deletePhoneAudioGiftOffer();
  await resetAnonymousAnalyticsPreference();
}
