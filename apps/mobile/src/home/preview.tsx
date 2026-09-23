import type { LanguageCode, SourceLanguageCode } from "@murmur/protocol/languages";
import type { TranslationSession, TranslationSpan } from "@murmur/protocol/session";
import type { ReportTranslationCategory } from "@murmur/protocol/transport/types";
import { useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { ScrollView } from "react-native";

import { type MurmurBillingContext, MurmurBillingFixtureProvider } from "../lib/billing/context";
import type { UiPreviewScreen } from "../lib/config";
import type { LiveTranslationController } from "../lib/live-translation/types";
import { createAudioCaptureDiagnosticsTracker } from "../lib/live-translation/audioDiagnostics";
import { createEmptyRealtimeTransportDiagnostics } from "../lib/providers/realtimeTranslationDiagnostics";
import { LanguagePickerController } from "./languagePicker";
import { previewBilling, previewBillingFor } from "../screens/previewFixtures";
import { screenPreviews } from "../screens/screenPreviews";
import { OutOfMinutesSheet } from "./outOfMinutesSheet";
import { UpdateRequiredSheet } from "./updateRequiredSheet";
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
  source_transcript_enabled: true,
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

const previewTranslationOnlyLive: LiveTranslationController = {
  ...previewLive,
  source_transcript_enabled: false,
  spans: previewLive.spans.map((span) => ({ ...span, source_caption: "" })),
};

const idleTranslationOnlyLive: LiveTranslationController = {
  ...previewTranslationOnlyLive,
  status: "idle",
};

const exhaustedLive: LiveTranslationController = {
  ...idleTranslationOnlyLive,
  error: "allowance_exhausted",
};

function noop(): void {}

export type PreviewScreen = UiPreviewScreen;

const previewRenderers: Readonly<Record<PreviewScreen, () => ReactNode>> = {
  ...screenPreviews,
  billing: screenPreviews["account-guest"],
  languages: () => <OnboardingPreview step="languages" />,
  "low-balance": () => (
    <TranslationPreview
      billing={previewBillingFor({ availableMs: 12 * 60_000, isRegistered: true, plan: "pro" })}
      live={idleTranslationOnlyLive}
    />
  ),
  "out-of-minutes": () => <OutOfMinutesPreview registered={false} />,
  "out-of-minutes-signed-in": () => <OutOfMinutesPreview registered />,
  picker: () => <PickerPreview mode="target" />,
  privacy: () => <OnboardingPreview step="privacy" />,
  "source-picker": () => <PickerPreview mode="source" />,
  translation: () => <TranslationPreview />,
  "translation-muted": () => <TranslationPreview audioPlaybackEnabled={false} />,
  "translation-only": () => <TranslationPreview live={previewTranslationOnlyLive} />,
  "update-required": () => (
    <>
      <TranslationPreview live={{ ...idleTranslationOnlyLive, error: "app_version_unsupported" }} />
      <UpdateRequiredSheet onClose={noop} open />
    </>
  ),
  welcome: () => <WelcomePreview />,
};

export function BloomPreview({ screen }: { screen: PreviewScreen }): ReactNode {
  return previewRenderers[screen]();
}

function OutOfMinutesPreview({ registered }: { registered: boolean }): ReactNode {
  const billing = previewBillingFor({ availableMs: 0, isRegistered: registered });
  return (
    <>
      <TranslationPreview billing={billing} live={exhaustedLive} />
      <OutOfMinutesSheet customer={billing.customer} onClose={noop} onSeePlans={noop} open />
    </>
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

function OnboardingPreview({ step }: { step: "languages" | "privacy" }): ReactNode {
  const props: VariantOnboardingProps = {
    canStart: true,
    captureSource: "microphone",
    devicePlaybackSupported: true,
    onContinue: noop,
    onCaptureSourceChange: noop,
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
    captureSource: "microphone",
    devicePlaybackSupported: true,
    onContinue: noop,
    onCaptureSourceChange: noop,
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

function TranslationPreview({
  audioPlaybackEnabled = true,
  billing = previewBilling,
  live = previewLive,
}: {
  audioPlaybackEnabled?: boolean;
  billing?: MurmurBillingContext;
  live?: LiveTranslationController;
} = {}): ReactNode {
  const timelineRef = useRef<ScrollView | null>(null);
  const autoScrollRef = useRef(true);
  const userInteractedRef = useRef(false);
  const viewModel = useMemo(
    () =>
      buildHomeViewModel({
        live,
        sourceLanguageCode: previewSourceLanguage,
        targetLanguageCode: previewTargetLanguage,
      }),
    [live],
  );
  const props: VariantShellProps = {
    audioPlaybackAvailable: true,
    audioPlaybackEnabled,
    audioState: null,
    autoScrollRef,
    captureSource: "microphone",
    devicePlaybackSupported: true,
    live,
    onAudioPlaybackEnabledChange: noop,
    onCaptureSourceChange: noop,
    onOpenLowBalance: noop,
    onOpenPicker: noop,
    onOpenSettings: noop,
    onPrimaryAction: noop,
    onSwapLanguages: noop,
    timelineRef,
    userInteractedRef,
    viewModel,
  };

  return (
    <MurmurBillingFixtureProvider billing={billing}>
      <BloomShell {...props} />
    </MurmurBillingFixtureProvider>
  );
}
