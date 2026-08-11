import type { LanguageCode, SourceLanguageCode } from "@murmur/protocol/languages";
import type { TranslationSession, TranslationSpan } from "@murmur/protocol/session";
import type { ReportTranslationCategory } from "@murmur/protocol/transport/types";
import { useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { ScrollView } from "react-native";

import type { MurmurBillingContext } from "../lib/billing/context";
import type { LiveTranslationController } from "../lib/live-translation/types";
import { createAudioCaptureDiagnosticsTracker } from "../lib/live-translation/audioDiagnostics";
import { createEmptyRealtimeTransportDiagnostics } from "../lib/providers/realtimeTranslationDiagnostics";
import { AccountBillingModal } from "./accountBillingModal";
import { LanguagePickerController } from "./languagePicker";
import { SettingsModal } from "./settingsModals";
import { buildHomeViewModel } from "./viewModel";
import { BloomOnboarding } from "./variants/bloom/onboarding";
import { BloomShell } from "./variants/bloom";
import type { VariantOnboardingProps, VariantShellProps } from "./variants/types";

const previewSourceLanguage: SourceLanguageCode = "ar";
const previewTargetLanguage: LanguageCode = "en";
const previewSourceCaption =
  "مرحباً، المدينة تبدو مختلفة عندما تفهم كل صوت. الآن أستطيع متابعة الحديث مباشرة باللغة الإنجليزية.";
const previewTranslation =
  "Hello, the city feels different when you understand every voice. Now I can follow the conversation live in English.";

const previewBilling: MurmurBillingContext = {
  busy: false,
  customer: {
    allowanceMs: 30 * 60_000,
    availableMs: 30 * 60_000,
    creditMs: 0,
    customerId: "preview-customer",
    earliestExpiryAtMs: null,
    fulfillmentEnabled: true,
    isRegistered: false,
    negativeMs: 0,
    plan: "free",
    purchasesEnabled: true,
    revenueCatCustomerId: "preview:preview-customer",
  },
  deleteAccount: async () => undefined,
  error: null,
  manageSubscription: async () => undefined,
  notice: null,
  openPaywall: async () => undefined,
  purchasesAvailable: true,
  refresh: async () => undefined,
  restorePurchases: async () => undefined,
  sendSignInCode: async () => undefined,
  switchAccount: async () => undefined,
  syncing: false,
  verifySignInCode: async () => undefined,
};

const previewLive: LiveTranslationController = {
  cancel: async () => undefined,
  debug_log: [],
  diagnostics_snapshot: {
    capture: createAudioCaptureDiagnosticsTracker().snapshot(),
    runtime: {
      capture_source: "microphone",
      playback_enabled: true,
      realtime_socket_open: false,
      source_char_count: previewSourceCaption.length,
      translated_char_count: previewTranslation.length,
    },
    transport: createEmptyRealtimeTransportDiagnostics(),
  },
  error: null,
  getDiagnosticsSnapshot: () => previewLive.diagnostics_snapshot,
  latency_report: {},
  latency_samples: [],
  invalidatePreparation: noop,
  preparation_status: "ready",
  prepare: async () => undefined,
  report_error: null,
  report_receipt_id: null,
  reportSpan: async (
    _span: TranslationSpan,
    _category: ReportTranslationCategory,
    _includeSnapshots?: boolean,
  ) => undefined,
  session: {
    created_at_ms: 1,
    identity: {
      app_session_id: "preview-session",
      audio_generation_id: 0,
      connection_id: "preview-connection",
      event_seq: 1,
      session_epoch: 1,
    },
    source_language: previewSourceLanguage,
    state: "live",
    target_language: previewTargetLanguage,
  } satisfies TranslationSession,
  spans: [
    {
      committed_translated_caption: previewTranslation,
      created_at_ms: 1,
      partial_translated_caption: null,
      provider_metadata: { model: "fixture", provider: "preview" },
      revision: 1,
      source_caption: previewSourceCaption,
      span_id: "preview-span",
      status: "committed",
      translated_caption: previewTranslation,
      updated_at_ms: 2,
    } satisfies TranslationSpan,
  ],
  start: async () => undefined,
  status: "live",
  stop: async () => undefined,
  tentative_source_caption: "",
};

const previewSettingsLive: LiveTranslationController = {
  ...previewLive,
  status: "idle",
};

function noop(): void {}

export type PreviewScreen =
  | "billing"
  | "languages"
  | "picker"
  | "privacy"
  | "settings"
  | "source-picker"
  | "translation"
  | "translation-muted"
  | "welcome";

export function BloomPreview({ screen }: { screen: PreviewScreen }): ReactNode {
  if (screen === "billing") {
    return <AccountBillingModal billing={previewBilling} onClose={noop} open />;
  }
  if (screen === "picker" || screen === "source-picker") {
    return <PickerPreview mode={screen === "source-picker" ? "source" : "target"} />;
  }
  if (screen === "settings") {
    return <SettingsPreview />;
  }
  if (screen === "privacy" || screen === "languages") {
    return <OnboardingPreview step={screen} />;
  }
  return screen === "translation-muted" ? (
    <TranslationPreview audioPlaybackEnabled={false} />
  ) : screen === "translation" ? (
    <TranslationPreview />
  ) : (
    <WelcomePreview />
  );
}

function PickerPreview({ mode }: { mode: "source" | "target" }): ReactNode {
  const [sourceLanguageCode, setSourceLanguageCode] =
    useState<SourceLanguageCode>(previewSourceLanguage);
  const [targetLanguageCode, setTargetLanguageCode] = useState<LanguageCode>(previewTargetLanguage);

  return (
    <>
      <TranslationPreview />
      <LanguagePickerController
        mode={mode}
        onClose={noop}
        setSourceLanguageCode={setSourceLanguageCode}
        setTargetLanguageCode={setTargetLanguageCode}
        sourceLanguageCode={sourceLanguageCode}
        targetLanguageCode={targetLanguageCode}
      />
    </>
  );
}

function SettingsPreview(): ReactNode {
  return (
    <>
      <TranslationPreview />
      <SettingsModal
        anonymousAnalyticsEnabled
        developerToolsEnabled={false}
        live={previewSettingsLive}
        onClose={noop}
        onAnonymousAnalyticsEnabledChange={noop}
        onDeleteLocalData={noop}
        onOpenDiagnostics={noop}
        onResetIdentity={noop}
        onShare={noop}
        open
        settingsMessage={null}
      />
    </>
  );
}

function OnboardingPreview({ step }: { step: "languages" | "privacy" }): ReactNode {
  const props: VariantOnboardingProps = {
    canStart: true,
    onContinue: noop,
    onOpenPicker: noop,
    onPrivacyAgree: noop,
    onStart: noop,
    onTogglePrivacyConsent: noop,
    privacyConsentChecked: false,
    sourceLanguage: "Arabic",
    step,
    targetLanguage: "English",
  };

  return <BloomOnboarding {...props} />;
}

function WelcomePreview(): ReactNode {
  const props: VariantOnboardingProps = {
    canStart: true,
    onContinue: noop,
    onOpenPicker: noop,
    onPrivacyAgree: noop,
    onStart: noop,
    onTogglePrivacyConsent: noop,
    privacyConsentChecked: false,
    sourceLanguage: "Arabic",
    step: "welcome",
    targetLanguage: "English",
  };

  return <BloomOnboarding {...props} />;
}

function TranslationPreview(
  { audioPlaybackEnabled = true }: { audioPlaybackEnabled?: boolean } = {},
): ReactNode {
  const timelineRef = useRef<ScrollView | null>(null);
  const autoScrollRef = useRef(true);
  const userInteractedRef = useRef(false);
  const viewModel = useMemo(
    () =>
      buildHomeViewModel({
        live: previewLive,
        sourceLanguageCode: previewSourceLanguage,
        targetLanguageCode: previewTargetLanguage,
      }),
    [],
  );
  const props: VariantShellProps = {
    audioPlaybackAvailable: true,
    audioPlaybackEnabled,
    audioState: null,
    autoScrollRef,
    captureSource: "microphone",
    devicePlaybackSupported: true,
    live: previewLive,
    onAudioPlaybackEnabledChange: noop,
    onCaptureSourceChange: noop,
    onOpenAccountBilling: noop,
    onOpenPicker: noop,
    onOpenSettings: noop,
    onPrimaryAction: noop,
    onSwapLanguages: noop,
    timelineRef,
    userInteractedRef,
    viewModel,
  };

  return <BloomShell {...props} />;
}
