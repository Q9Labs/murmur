import Constants from "expo-constants";
import * as Linking from "expo-linking";
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
import { getAcquisitionContextFromUrl } from "../lib/acquisition";
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
import { requestMurmurReview } from "../lib/requestReview";
import { shareMurmur } from "../lib/shareMurmur";
import { useLiveTranslation } from "../lib/useLiveTranslation";
import type { OnboardingStep, PickerMode } from "./components";
import {
  deleteStoredAudioPlaybackEnabled,
  getStoredAudioPlaybackEnabled,
  setStoredAudioPlaybackEnabled,
} from "./audioPlaybackPreference";
import { HomeExperience } from "./experience";
import { OnboardingScreen } from "./onboardingScreen";
import { deleteStoredUiVariant } from "./variants/preference";
import { buildHomeViewModel } from "./viewModel";

const audioPlaybackSaveError = "Could not save the audio setting. Please try again.";
const localDataDeletedMessage =
  "Local Murmur data deleted. Privacy acknowledgement, install id, and rating eligibility were cleared.";
const localDataDeleteError = "Could not delete local data. Please try again.";

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
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null);
  const [audioPlaybackEnabled, setAudioPlaybackEnabled] = useState(true);
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

  const live = useLiveTranslation({
    acquisition,
    playback_enabled: audioPlaybackEnabled,
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
    setAcquisition(incomingAcquisition);
  }, [incomingAcquisition, incomingUrl]);

  useEffect(() => {
    if (live.status === "live" && acquisition) {
      setAcquisition(undefined);
    }
  }, [acquisition, live.status]);

  useEffect(() => {
    if (privacyAcknowledged && onboardingStep === "done") {
      void live.prepare();
    }
  }, [live.prepare, onboardingStep, privacyAcknowledged]);

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
    void audioPreferenceController.restore();
    return () => audioPreferenceController.dispose();
  }, [audioPreferenceController]);

  useEffect(() => {
    const subscription = MurmurAudioModule.addListener(
      "onAudioState",
      (nextState: AudioStateEvent) => {
        setAudioState((current) => newestAudioState(current, nextState));
      },
    );
    void MurmurAudioModule.getAudioState().then((nextState) => {
      setAudioState((current) => newestAudioState(current, nextState as AudioStateEvent));
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
    await startLiveTranslation();
  }

  async function startLiveTranslation(): Promise<void> {
    await audioPreferenceController.waitForRestore();
    await live.start();
  }

  async function handlePrimaryAction(): Promise<void> {
    if (viewModel.isLive) {
      const completion = await live.stop();
      if (completion) {
        await handleCompletedSessionEngagement(completion);
      }
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
      />
    );
  }

  return (
    <HomeExperience
      audioPlaybackEnabled={audioPlaybackEnabled}
      audioState={audioState}
      autoScrollRef={autoScrollRef}
      diagnosticsOpen={diagnosticsOpen}
      developerToolsEnabled={__DEV__}
      live={live}
      networkType={networkType}
      onCloseDiagnostics={() => setDiagnosticsOpen(false)}
      onClosePicker={() => setPickerMode(null)}
      onCloseSettings={() => setSettingsOpen(false)}
      onAudioPlaybackEnabledChange={(enabled) => {
        void audioPreferenceController.setEnabled(enabled);
      }}
      onDeleteLocalData={() => {
        void audioPreferenceController.deleteLocalData(
          () => deleteLocalData(live.cancel),
          () => {
            live.invalidatePreparation();
            setPrivacyAcknowledged(false);
            setPrivacyConsentChecked(false);
          },
        );
      }}
      onOpenDiagnostics={() => setDiagnosticsOpen(true)}
      onOpenPicker={setPickerMode}
      onOpenSettings={() => setSettingsOpen(true)}
      onPrimaryAction={() => void handlePrimaryAction()}
      onResetIdentity={() => void resetIdentity(live, setSettingsMessage)}
      onShare={() => void shareMurmur()}
      onSwapLanguages={swapLanguages}
      pickerMode={pickerMode}
      setSourceLanguageCode={setSourceLanguageCode}
      setTargetLanguageCode={setTargetLanguageCode}
      settingsMessage={settingsMessage}
      settingsOpen={settingsOpen}
      sourceLanguageCode={sourceLanguageCode}
      targetLanguageCode={targetLanguageCode}
      timelineRef={timelineRef}
      userInteractedRef={userInteractedRef}
      viewModel={viewModel}
    />
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
  setMessage("Accountless identity reset. The next session will use a fresh install id.");
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

async function deleteLocalData(cancel: () => Promise<void>): Promise<void> {
  await cancel();
  await deleteLocalMurmurData();
  await deleteStoredAudioPlaybackEnabled();
  await deleteStoredUiVariant();
  await deleteEngagementState();
}
