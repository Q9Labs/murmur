import type { LanguageCode, SourceLanguageCode } from "@murmur/protocol/languages";
import type { TranslationSession, TranslationSpan } from "@murmur/protocol/session";
import type { ReportTranslationCategory } from "@murmur/protocol/transport/types";
import { useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Platform, type ScrollView } from "react-native";

import { UiLocaleOverride } from "../i18n/provider";
import { useUiLocale } from "../i18n/runtime";
import type { UiLocale } from "../i18n/types";
import { type MurmurBillingContext, MurmurBillingFixtureProvider } from "../lib/billing/context";
import type { UiPreviewScreen } from "../lib/config";
import type { LiveTranslationController } from "../lib/live-translation/types";
import type { AudioCaptureSource } from "../../modules/murmur-audio";
import { createAudioCaptureDiagnosticsTracker } from "../lib/live-translation/audioDiagnostics";
import { createEmptyRealtimeTransportDiagnostics } from "../lib/providers/realtimeTranslationDiagnostics";
import { LanguagePickerController } from "./languagePicker";
import { previewBilling, previewBillingFor } from "../screens/previewFixtures";
import { RatingSheet } from "../screens/rating/ratingSheet";
import { screenPreviews } from "../screens/screenPreviews";
import { OutOfMinutesSheet } from "./outOfMinutesSheet";
import { UpdateRequiredSheet } from "./updateRequiredSheet";
import { buildHomeViewModel, type HomeViewModel } from "./viewModel";
import { type PreviewConversation, previewConversationFor } from "./previewConversation";
import { BloomOnboarding } from "./variants/bloom/onboarding";
import { BloomShell } from "./variants/bloom";
import type { VariantOnboardingProps, VariantShellProps } from "./variants/types";

type PreviewLiveVariant = "app-version-unsupported" | "exhausted" | "idle" | "live" | "translation-only";

function createPreviewLive(conversation: PreviewConversation): LiveTranslationController {
  const live: LiveTranslationController = {
    cancel: async () => undefined,
    clearRatingDecision: noop,
    debug_log: [],
    diagnostics_snapshot: {
      capture: createAudioCaptureDiagnosticsTracker().snapshot(),
      runtime: {
        capture_source: "microphone",
        playback_enabled: true,
        realtime_socket_open: false,
        source_char_count: conversation.sourceCaption.length,
        translated_char_count: conversation.translation.length,
      },
      transport: createEmptyRealtimeTransportDiagnostics(),
    },
    error: null,
    getDiagnosticsSnapshot: () => live.diagnostics_snapshot,
    latency_report: {},
    latency_samples: [],
    invalidatePreparation: noop,
    preparation_status: "ready",
    rating_decision: null,
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
      source_language: conversation.sourceLanguage,
      state: "live",
      target_language: conversation.targetLanguage,
    } satisfies TranslationSession,
    source_transcript_enabled: true,
    spans: [
      {
        committed_translated_caption: conversation.translation,
        created_at_ms: 1,
        partial_translated_caption: null,
        provider_metadata: { model: "fixture", provider: "preview" },
        revision: 1,
        source_caption: conversation.sourceCaption,
        span_id: "preview-span",
        status: "committed",
        translated_caption: conversation.translation,
        updated_at_ms: 2,
      } satisfies TranslationSpan,
    ],
    start: async () => undefined,
    status: "live",
    stop: async () => undefined,
    tentative_source_caption: "",
  };
  return live;
}

function previewLiveFor(conversation: PreviewConversation, variant: PreviewLiveVariant): LiveTranslationController {
  const live = createPreviewLive(conversation);
  if (variant === "live") {
    return live;
  }
  const translationOnly: LiveTranslationController = {
    ...live,
    source_transcript_enabled: false,
    spans: live.spans.map((span) => ({ ...span, source_caption: "" })),
  };
  if (variant === "translation-only") {
    return translationOnly;
  }
  const idle: LiveTranslationController = { ...translationOnly, status: "idle" };
  if (variant === "idle") {
    return idle;
  }
  return { ...idle, error: variant === "exhausted" ? "allowance_exhausted" : "app_version_unsupported" };
}

// Phone audio capture exists on Android only (the native module reports it unsupported on iOS).
function previewDevicePlaybackSupported(): boolean {
  return Platform.OS === "android";
}

function usePreviewConversation(): PreviewConversation {
  const { locale } = useUiLocale();
  return previewConversationFor(locale);
}

function noop(): void {}

export type PreviewScreen = UiPreviewScreen;

const previewRenderers: Readonly<Record<PreviewScreen, () => ReactNode>> = {
  ...screenPreviews,
  billing: screenPreviews["account-guest"],
  languages: () => <OnboardingPreview step="languages" />,
  "low-balance": () => (
    <TranslationPreview
      billing={previewBillingFor({ availableMs: 12 * 60_000, isRegistered: true, plan: "pro" })}
      live="idle"
    />
  ),
  "out-of-minutes": () => <OutOfMinutesPreview registered={false} />,
  "out-of-minutes-signed-in": () => <OutOfMinutesPreview registered />,
  picker: () => <PickerPreview mode="target" />,
  privacy: () => <OnboardingPreview step="privacy" />,
  "source-picker": () => <PickerPreview mode="source" />,
  rating: () => <RatingPreview />,
  "rating-answered": () => <RatingPreview answered />,
  translation: () => <TranslationPreview />,
  "translation-background": () => <TranslationPreview listeningInBackground />,
  "translation-muted": () => <TranslationPreview audioPlaybackEnabled={false} />,
  "translation-only": () => <TranslationPreview live="translation-only" />,
  "translation-phone-audio": () => <TranslationPreview captureSource="device_playback" />,
  "update-required": () => (
    <>
      <TranslationPreview live="app-version-unsupported" />
      <UpdateRequiredSheet onClose={noop} open />
    </>
  ),
  welcome: () => <OnboardingPreview step="welcome" />,
};

export function BloomPreview({ locale = null, screen }: { locale?: UiLocale | null; screen: PreviewScreen }): ReactNode {
  const Screen = previewRenderers[screen];
  return locale ? <UiLocaleOverride locale={locale}><Screen /></UiLocaleOverride> : <Screen />;
}

function OutOfMinutesPreview({ registered }: { registered: boolean }): ReactNode {
  const billing = previewBillingFor({ availableMs: 0, isRegistered: registered });
  return (
    <>
      <TranslationPreview billing={billing} live="exhausted" />
      <OutOfMinutesSheet customer={billing.customer} onClose={noop} onSeePlans={noop} open />
    </>
  );
}

function RatingPreview({ answered = false }: { answered?: boolean }): ReactNode {
  return (
    <>
      <TranslationPreview live="idle" />
      <RatingSheet
        initialAnswer={answered ? { otherText: "Parent evening at school", stars: 5, use: "other" } : undefined}
        onClose={noop}
        onSubmit={noop}
        open
      />
    </>
  );
}

function PickerPreview({ mode }: { mode: "source" | "target" }): ReactNode {
  const conversation = usePreviewConversation();
  const [sourceLanguageCode, setSourceLanguageCode] = useState<SourceLanguageCode>(conversation.sourceLanguage);
  const [targetLanguageCode, setTargetLanguageCode] = useState<LanguageCode>(conversation.targetLanguage);

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

function OnboardingPreview({ step }: { step: VariantOnboardingProps["step"] }): ReactNode {
  const { viewModel } = usePreviewHome({ captureSource: "microphone", variant: "idle" });
  const props: VariantOnboardingProps = {
    canStart: true,
    captureSource: "microphone",
    devicePlaybackSupported: previewDevicePlaybackSupported(),
    onContinue: noop,
    onCaptureSourceChange: noop,
    onOpenPicker: noop,
    onPrivacyAgree: noop,
    onStart: noop,
    onTogglePrivacyConsent: noop,
    privacyConsentChecked: false,
    sourceLanguage: viewModel.sourceLanguageDisplayName,
    step,
    targetLanguage: viewModel.targetLanguageDisplayName,
  };

  return <BloomOnboarding {...props} />;
}

function usePreviewHome({
  captureSource,
  variant,
}: {
  captureSource: AudioCaptureSource;
  variant: PreviewLiveVariant;
}): { live: LiveTranslationController; viewModel: HomeViewModel } {
  const conversation = usePreviewConversation();
  const { locale, t } = useUiLocale();
  return useMemo(() => {
    const live = previewLiveFor(conversation, variant);
    const viewModel = buildHomeViewModel({
      captureSource,
      live,
      sourceLanguageCode: conversation.sourceLanguage,
      targetLanguageCode: conversation.targetLanguage,
      translate: t,
      uiLocale: locale,
    });
    return { live, viewModel };
  }, [captureSource, conversation, locale, t, variant]);
}

function TranslationPreview({
  audioPlaybackEnabled = true,
  billing = previewBilling,
  captureSource = "microphone",
  listeningInBackground = false,
  live = "live",
}: {
  audioPlaybackEnabled?: boolean;
  billing?: MurmurBillingContext;
  captureSource?: AudioCaptureSource;
  listeningInBackground?: boolean;
  live?: PreviewLiveVariant;
} = {}): ReactNode {
  const timelineRef = useRef<ScrollView | null>(null);
  const autoScrollRef = useRef(true);
  const userInteractedRef = useRef(false);
  const { live: liveController, viewModel } = usePreviewHome({ captureSource, variant: live });
  const props: VariantShellProps = {
    audioPlaybackAvailable: true,
    audioPlaybackEnabled,
    audioState: null,
    autoScrollRef,
    captureSource,
    devicePlaybackSupported: previewDevicePlaybackSupported(),
    listeningInBackground,
    live: liveController,
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
