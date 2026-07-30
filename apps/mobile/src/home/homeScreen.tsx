import * as Network from "expo-network";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { ScrollView } from "react-native";

import {
  autoSourceLanguageCode,
  type LanguageCode,
  type SourceLanguageCode,
} from "@murmur/protocol/languages";

import MurmurAudioModule, { type AudioStateEvent } from "../../modules/murmur-audio";
import {
  acknowledgePrivacyDisclosure,
  deleteLocalMurmurData,
  hasAcknowledgedPrivacyDisclosure,
  resetInstallId,
} from "../lib/installIdentity";
import { useLiveTranslation } from "../lib/useLiveTranslation";
import type { OnboardingStep, PickerMode } from "./components";
import { HomeExperience } from "./experience";
import { OnboardingScreen } from "./onboardingScreen";
import { deleteStoredUiVariant, getStoredUiVariant, setStoredUiVariant } from "./variants/preference";
import type { UiVariant } from "./variants/types";
import { buildHomeViewModel } from "./viewModel";

export default function HomeScreen(): ReactNode {
  const [sourceLanguageCode, setSourceLanguageCode] = useState<SourceLanguageCode>("en");
  const [targetLanguageCode, setTargetLanguageCode] = useState<LanguageCode>("ar");
  const [onboardingStep, setOnboardingStep] = useState<OnboardingStep>("welcome");
  const [privacyAcknowledged, setPrivacyAcknowledged] = useState(false);
  const [privacyConsentChecked, setPrivacyConsentChecked] = useState(false);
  const [pickerMode, setPickerMode] = useState<PickerMode>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null);
  const [uiVariant, setUiVariant] = useState<UiVariant>("console");
  const [audioState, setAudioState] = useState<AudioStateEvent | null>(null);
  const [networkType, setNetworkType] = useState("unknown");
  const uiVariantSelectionRef = useRef(false);
  const timelineRef = useRef<ScrollView | null>(null);
  const autoScrollRef = useRef(true);
  const userInteractedRef = useRef(false);

  const live = useLiveTranslation({
    source_language: sourceLanguageCode,
    target_language: targetLanguageCode,
  });
  const viewModel = useMemo(
    () => buildHomeViewModel({
      live,
      sourceLanguageCode,
      targetLanguageCode,
    }),
    [live, sourceLanguageCode, targetLanguageCode],
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
    let mounted = true;
    void hasAcknowledgedPrivacyDisclosure().then((acknowledged) => {
      if (mounted) {
        setPrivacyAcknowledged(acknowledged);
        if (acknowledged) {
          setOnboardingStep("done");
        }
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
      await live.stop();
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
      autoScrollRef={autoScrollRef}
      diagnosticsOpen={diagnosticsOpen}
      live={live}
      networkType={networkType}
      onCloseDiagnostics={() => setDiagnosticsOpen(false)}
      onClosePicker={() => setPickerMode(null)}
      onCloseSettings={() => setSettingsOpen(false)}
      onDeleteLocalData={() => void deleteLocalData(setSettingsMessage, live.cancel, () => {
        setPrivacyAcknowledged(false);
        setPrivacyConsentChecked(false);
        uiVariantSelectionRef.current = true;
        setUiVariant("console");
      })}
      onOpenDiagnostics={() => setDiagnosticsOpen(true)}
      onOpenPicker={setPickerMode}
      onOpenSettings={() => setSettingsOpen(true)}
      onPrimaryAction={() => void handlePrimaryAction()}
      onResetIdentity={() => void resetIdentity(setSettingsMessage)}
      onSelectUiVariant={selectUiVariant}
      onSwapLanguages={swapLanguages}
      pickerMode={pickerMode}
      setSourceLanguageCode={setSourceLanguageCode}
      setTargetLanguageCode={setTargetLanguageCode}
      settingsMessage={settingsMessage}
      settingsOpen={settingsOpen}
      sourceLanguageCode={sourceLanguageCode}
      targetLanguageCode={targetLanguageCode}
      timelineRef={timelineRef}
      uiVariant={uiVariant}
      userInteractedRef={userInteractedRef}
      viewModel={viewModel}
    />
  );
}

async function resetIdentity(setMessage: (message: string | null) => void): Promise<void> {
  await resetInstallId();
  setMessage("Accountless identity reset. The next session will use a fresh install id.");
}

async function deleteLocalData(
  setMessage: (message: string | null) => void,
  cancel: () => Promise<void>,
  onDeleted: () => void,
): Promise<void> {
  await cancel();
  await deleteLocalMurmurData();
  await deleteStoredUiVariant();
  onDeleted();
  setMessage("Local Murmur data deleted. Privacy acknowledgement and install id were cleared.");
}
