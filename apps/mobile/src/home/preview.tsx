import type { LanguageCode, SourceLanguageCode } from "@murmur/protocol/languages";
import type { TranslationSession, TranslationSpan } from "@murmur/protocol/session";
import type { ReportTranslationCategory } from "@murmur/protocol/transport/types";
import { useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { ScrollView } from "react-native";

import { freeAllowanceMinutes } from "../lib/billing/allowance";
import { type MurmurBillingContext, MurmurBillingFixtureProvider } from "../lib/billing/context";
import type { MurmurCustomer } from "../lib/billing/customerResponse";
import type { UiPreviewScreen } from "../lib/config";
import type { LiveTranslationController } from "../lib/live-translation/types";
import { createAudioCaptureDiagnosticsTracker } from "../lib/live-translation/audioDiagnostics";
import { createEmptyRealtimeTransportDiagnostics } from "../lib/providers/realtimeTranslationDiagnostics";
import { AccountBillingModal } from "./accountBillingModal";
import { LanguagePickerController } from "./languagePicker";
import { OutOfMinutesSheet, type PlanListState } from "./outOfMinutesSheet";
import { SettingsModal } from "./settingsModals";
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

const previewCustomer: MurmurCustomer = {
  allowanceMs: freeAllowanceMinutes * 60_000,
  availableMs: freeAllowanceMinutes * 60_000,
  creditMs: 0,
  customerId: "preview-customer",
  earliestExpiryAtMs: null,
  fulfillmentEnabled: true,
  isRegistered: false,
  negativeMs: 0,
  plan: "free",
  purchasesEnabled: true,
  revenueCatCustomerId: "preview:preview-customer",
};

const previewBilling: MurmurBillingContext = {
  busy: false,
  config: { lowBalanceThresholdMinutes: 15, paywallOfferingId: null },
  customer: previewCustomer,
  deleteAccount: async () => undefined,
  error: null,
  loadPlans: async () => [],
  manageSubscription: async () => undefined,
  notice: null,
  openPaywall: async () => undefined,
  purchasePlan: async () => undefined,
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

const previewSettingsLive: LiveTranslationController = {
  ...previewLive,
  status: "idle",
};

const previewTranslationOnlyLive: LiveTranslationController = {
  ...previewLive,
  source_transcript_enabled: false,
  spans: previewLive.spans.map((span) => ({ ...span, source_caption: "" })),
};

// Fixture prices for screenshots only; the app always shows store prices.
const previewPlans: PlanListState = {
  plans: [
    { id: "$rc_monthly", kind: "pro", price: "$9.99 / month", title: "Murmur Pro" },
    { id: "$rc_annual", kind: "pro", price: "$99.99 / year", title: "Murmur Pro Annual" },
    { id: "trip_pass", kind: "top_up", price: "$7.99", title: "Trip Pass · 60 minutes" },
  ],
  status: "ready",
};

function billingFor(customer: Partial<MurmurCustomer>): MurmurBillingContext {
  return { ...previewBilling, customer: { ...previewCustomer, ...customer } };
}

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
  billing: () => <AccountBillingModal billing={previewBilling} onClose={noop} open />,
  languages: () => <OnboardingPreview step="languages" />,
  "low-balance": () => (
    <TranslationPreview
      billing={billingFor({ availableMs: 12 * 60_000, isRegistered: true, plan: "pro" })}
      live={idleTranslationOnlyLive}
    />
  ),
  "out-of-minutes": () => <OutOfMinutesPreview registered={false} />,
  "out-of-minutes-signed-in": () => <OutOfMinutesPreview registered />,
  picker: () => <PickerPreview mode="target" />,
  privacy: () => <OnboardingPreview step="privacy" />,
  settings: () => <SettingsPreview />,
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
  const billing = billingFor({ availableMs: 0, isRegistered: registered });
  return (
    <>
      <TranslationPreview billing={billing} live={exhaustedLive} />
      <OutOfMinutesSheet
        billing={billing}
        onClose={noop}
        onRetryPlans={noop}
        open
        plans={previewPlans}
        reason="exhausted"
      />
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
