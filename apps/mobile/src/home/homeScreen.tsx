import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { ScrollView } from "react-native";
import Constants from "expo-constants";
import * as Linking from "expo-linking";
import * as Network from "expo-network";

import MurmurAudioModule, { type AudioStateEvent } from "../../modules/murmur-audio";
import { getAcquisitionContextFromUrl } from "../lib/acquisition";
import { isUltravoxVadEnabledByDefault } from "../lib/config";
import {
  deleteEngagementState,
  markReviewRequested,
  recordSessionOutcome,
} from "../lib/engagement";
import {
  acknowledgePrivacyDisclosure,
  deleteLocalMurmurData,
  hasAcknowledgedPrivacyDisclosure,
  resetInstallId,
} from "../lib/installIdentity";
import { shareMurmur } from "../lib/shareMurmur";
import { requestMurmurReview } from "../lib/requestReview";
import {
  autoSourceLanguageCode,
  type LanguageCode,
  type SourceLanguageCode,
} from "@murmur/protocol/languages";
import { defaultTranslationModelRoute } from "@murmur/protocol/translationModelRoutes";
import type { TranslationMode, TranslationModelRoute } from "@murmur/protocol/transport/types";
import { useLiveTranslation } from "../lib/useLiveTranslation";
import type { OnboardingStep, PickerMode } from "./components";
import { HomeExperience } from "./experience";
import { OnboardingScreen } from "./onboardingScreen";
import {
  getInitialDevModelRoute,
  isDevModelPickerEnabled,
} from "./modelRoute";
import { deleteStoredUiVariant, getStoredUiVariant, setStoredUiVariant } from "./variants/preference";
import type { UiVariant } from "./variants/types";
import { buildHomeViewModel } from "./viewModel";

export default function HomeScreen(): ReactNode {
  const [sourceLanguageCode, setSourceLanguageCode] = useState<SourceLanguageCode>("en");
  const [targetLanguageCode, setTargetLanguageCode] = useState<LanguageCode>("ar");
  const [translationMode, setTranslationMode] = useState<TranslationMode>("phrase");
  const [devModelRoute, setDevModelRoute] = useState<TranslationModelRoute>(getInitialDevModelRoute);
  const [ultravoxVadEnabled, setUltravoxVadEnabled] = useState(isUltravoxVadEnabledByDefault);
  const [devModelRouteOpen, setDevModelRouteOpen] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState<OnboardingStep>("welcome");
  const [privacyAcknowledged, setPrivacyAcknowledged] = useState(false);
  const [privacyConsentChecked, setPrivacyConsentChecked] = useState(false);
  const [pickerMode, setPickerMode] = useState<PickerMode>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null);
  const [uiVariant, setUiVariant] = useState<UiVariant>("console");
  const [audioState, setAudioState] = useState<AudioStateEvent | null>(null);
  const [networkType, setNetworkType] = useState<string>("unknown");
  const uiVariantSelectionRef = useRef(false);
  const continuousTimelineRef = useRef<ScrollView | null>(null);
  const continuousAutoScrollRef = useRef(true);
  const continuousUserInteractedRef = useRef(false);

  const devModelPickerEnabled = isDevModelPickerEnabled();
  const activeModelRoute = devModelPickerEnabled ? devModelRoute : defaultTranslationModelRoute;
  const incomingUrl = Linking.useURL();
  const incomingAcquisition = useMemo(
    () => getAcquisitionContextFromUrl(incomingUrl),
    [incomingUrl],
  );
  const [acquisition, setAcquisition] = useState(incomingAcquisition);
  const live = useLiveTranslation({
    acquisition,
    source_language: sourceLanguageCode,
    target_language: targetLanguageCode,
    translation_model_route: activeModelRoute,
    translation_mode: translationMode,
    ultravox_vad_enabled: ultravoxVadEnabled,
  });
  const viewModel = useMemo(
    () =>
      buildHomeViewModel({
        live,
        sourceLanguageCode,
        targetLanguageCode,
      }),
    [
      live,
      sourceLanguageCode,
      targetLanguageCode,
    ],
  );
  const continuousAutoScrollKey = useMemo(
    () =>
      live.spans
        .map((span) => [
          span.span_id,
          span.status,
          span.partial_translated_caption?.length ?? 0,
          span.committed_translated_caption?.length ?? 0,
        ].join(":"))
        .join("|"),
    [live.spans],
  );

  useEffect(() => {
    setAcquisition(incomingAcquisition);
  }, [incomingAcquisition, incomingUrl]);

  useEffect(() => {
    if (live.status === "live" && acquisition) {
      setAcquisition(undefined);
    }
  }, [acquisition, live.status]);

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
    let mounted = true;
    void getStoredUiVariant().then((storedVariant) => {
      if (mounted && storedVariant && !uiVariantSelectionRef.current) {
        setUiVariant(storedVariant);
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

  useEffect(() => {
    if (translationMode === "continuous" && viewModel.canChangeLanguages) {
      continuousAutoScrollRef.current = true;
      continuousUserInteractedRef.current = false;
    }
  }, [translationMode, viewModel.canChangeLanguages]);

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
    if (viewModel.isLive) {
      const completedSession = {
        committed_caption_count: live.spans.filter(
          (span) =>
            span.status === "committed" &&
            Boolean(span.committed_translated_caption?.trim()),
        ).length,
        duration_ms: Math.max(0, Date.now() - live.session.created_at_ms),
        error: live.error,
        translation_mode: live.session.translation_mode,
      };
      await live.stop();
      await handleCompletedSessionEngagement(completedSession);
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
    await live.start();
  }

  function selectUiVariant(variant: UiVariant): void {
    uiVariantSelectionRef.current = true;
    setUiVariant(variant);
    void setStoredUiVariant(variant);
  }

  function swapLanguages(): void {
    if (sourceLanguageCode === autoSourceLanguageCode) {
      return;
    }
    setSourceLanguageCode(targetLanguageCode);
    setTargetLanguageCode(sourceLanguageCode);
  }

  if (onboardingStep !== "done") {
    return (
      <OnboardingScreen
        canStart={viewModel.canStart}
        onContinue={() => setOnboardingStep("privacy")}
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
        uiVariant={uiVariant}
      />
    );
  }

  return (
    <HomeExperience
      audioState={audioState}
      continuousAutoScrollRef={continuousAutoScrollRef}
      continuousTimelineRef={continuousTimelineRef}
      continuousUserInteractedRef={continuousUserInteractedRef}
      devModelPickerEnabled={devModelPickerEnabled}
      devModelRoute={devModelRoute}
      devModelRouteOpen={devModelRouteOpen}
      diagnosticsOpen={diagnosticsOpen}
      live={live}
      networkType={networkType}
      onCloseDevModelRoute={() => setDevModelRouteOpen(false)}
      onCloseDiagnostics={() => setDiagnosticsOpen(false)}
      onClosePicker={() => setPickerMode(null)}
      onCloseSettings={() => setSettingsOpen(false)}
      onDeleteLocalData={() => void deleteLocalData(setSettingsMessage, live.cancel, () => {
        setPrivacyAcknowledged(false);
        setPrivacyConsentChecked(false);
        uiVariantSelectionRef.current = true;
        setUiVariant("console");
      })}
      onOpenDevModelRoute={() => setDevModelRouteOpen(true)}
      onOpenDiagnostics={() => setDiagnosticsOpen(true)}
      onOpenPicker={setPickerMode}
      onOpenSettings={() => setSettingsOpen(true)}
      onPrimaryAction={() => void handlePrimaryAction()}
      onResetIdentity={() => void resetIdentity(setSettingsMessage)}
      onSelectDevModelRoute={(route) => {
        setDevModelRoute(route);
        setDevModelRouteOpen(false);
      }}
      onSelectUiVariant={selectUiVariant}
      onShare={() => void shareMurmur()}
      onSwapLanguages={swapLanguages}
      onToggleTranslationMode={setTranslationMode}
      onToggleUltravoxVad={() => setUltravoxVadEnabled((current) => !current)}
      pickerMode={pickerMode}
      setSourceLanguageCode={setSourceLanguageCode}
      setTargetLanguageCode={setTargetLanguageCode}
      settingsMessage={settingsMessage}
      settingsOpen={settingsOpen}
      sourceLanguageCode={sourceLanguageCode}
      targetLanguageCode={targetLanguageCode}
      translationMode={translationMode}
      uiVariant={uiVariant}
      ultravoxVadEnabled={ultravoxVadEnabled}
      viewModel={viewModel}
    />
  );
}

async function handleCompletedSessionEngagement(
  outcome: Parameters<typeof recordSessionOutcome>[0]["outcome"],
): Promise<void> {
  const appVersion = Constants.expoConfig?.version ?? "unknown";
  const engagement = await recordSessionOutcome({
    app_version: appVersion,
    outcome,
  });
  if (!engagement.should_request_review) {
    return;
  }
  if (await requestMurmurReview()) {
    await markReviewRequested({ app_version: appVersion });
  }
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
  await deleteEngagementState();
  await deleteStoredUiVariant();
  onDeleted?.();
  setMessage("Local Murmur data deleted. Privacy acknowledgement, install id, app style, and rating eligibility were cleared.");
}
