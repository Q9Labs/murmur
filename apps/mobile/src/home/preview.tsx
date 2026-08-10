import type { LanguageCode, SourceLanguageCode } from "@murmur/protocol/languages";
import type { TranslationSession, TranslationSpan } from "@murmur/protocol/session";
import type { ReportTranslationCategory } from "@murmur/protocol/transport/types";
import { useMemo, useRef } from "react";
import type { ReactNode } from "react";
import type { ScrollView } from "react-native";

// cspell:ignore cada ciudad cuando diferente entiendes siente
import type { LiveTranslationController } from "../lib/live-translation/types";
import { buildHomeViewModel } from "./viewModel";
import { BloomOnboarding } from "./variants/bloom/onboarding";
import { BloomShell } from "./variants/bloom";
import type { VariantOnboardingProps, VariantShellProps } from "./variants/types";

const previewSourceLanguage: SourceLanguageCode = "en";
const previewTargetLanguage: LanguageCode = "es";
const previewSourceCaption = "The city feels different when you understand every voice.";
const previewTranslation = "La ciudad se siente diferente cuando entiendes cada voz.";

const previewLive: LiveTranslationController = {
  cancel: async () => undefined,
  debug_log: [],
  diagnostics_snapshot: {
    runtime: {
      realtime_socket_open: false,
      source_char_count: previewSourceCaption.length,
      translated_char_count: previewTranslation.length,
    },
  },
  error: null,
  latency_report: {},
  latency_samples: [],
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

const noop = (): void => undefined;

export type PreviewScreen = "translation" | "welcome";

export function BloomPreview({ screen }: { screen: PreviewScreen }): ReactNode {
  return screen === "translation" ? <TranslationPreview /> : <WelcomePreview />;
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
    sourceLanguage: "English",
    step: "welcome",
    targetLanguage: "Spanish",
  };

  return <BloomOnboarding {...props} />;
}

function TranslationPreview(): ReactNode {
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
    audioState: null,
    autoScrollRef,
    live: previewLive,
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
