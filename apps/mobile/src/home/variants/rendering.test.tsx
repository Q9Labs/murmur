import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createSpan } from "@murmur/protocol/session";
import { buildHomeViewModel } from "../viewModel";
import { FieldConsoleShell } from "./fieldConsole";
import { OnboardingFlow, type OnboardingText, type OnboardingTheme } from "./onboardingFlow";
import { continuousScrollHandlers } from "./shared";
import type { VariantOnboardingProps, VariantShellProps } from "./types";

const harness = vi.hoisted(() => ({
  controls: [] as Array<{
    accessibilityLabel?: string;
    accessibilityRole?: string;
    disabled?: boolean;
    onPress?: () => void;
  }>,
  scheme: "dark" as "dark" | "light" | null,
}));

vi.mock("react-native", () => {
  function createStyleSheet<T>(styles: T): T {
    return styles;
  }

  function Primitive({ children }: { children?: unknown }): unknown {
    return children ?? null;
  }

  function Pressable({
    accessibilityLabel,
    accessibilityRole,
    children,
    disabled,
    onPress,
    style,
  }: {
    accessibilityLabel?: string;
    accessibilityRole?: string;
    children?: unknown;
    disabled?: boolean;
    onPress?: () => void;
    style?: unknown;
  }): unknown {
    harness.controls.push({ accessibilityLabel, accessibilityRole, disabled, onPress });
    if (typeof style === "function") {
      style({ pressed: false });
    }
    return typeof children === "function" ? children({ pressed: false }) : children ?? null;
  }

  return {
    Platform: { OS: "ios", select: <T,>(values: { default?: T; ios?: T }): T | undefined => values.ios ?? values.default },
    Pressable,
    ScrollView: Primitive,
    StatusBar: () => null,
    StyleSheet: { create: createStyleSheet, hairlineWidth: 1 },
    Text: Primitive,
    useColorScheme: () => harness.scheme,
    View: Primitive,
  };
});

vi.mock("react-native-safe-area-context", () => ({
  SafeAreaView: ({ children }: { children?: unknown }): unknown => children ?? null,
}));

vi.mock("./hooks", () => ({
  useMicLevelValue: () => 0.75,
}));

const onboardingTheme: OnboardingTheme = {
  body: {},
  buttonStyle: {},
  buttonTextStyle: {},
  checkbox: {},
  checkboxChecked: {},
  checkboxMark: {},
  consentRow: {},
  copy: {},
  eyebrow: {},
  footer: {},
  pressed: {},
  setupRow: {},
  setupValue: {},
  title: {},
};

const onboardingText: OnboardingText = {
  agreeLabel: "Agree",
  continueLabel: "Continue",
  languagesEyebrowText: "Languages",
  languagesTitle: "Choose languages",
  listenLabel: "Listen",
  privacyEyebrowText: "Privacy",
  privacyTitle: "Review",
  sourceLabel: "Speak",
  targetLabel: "Translate",
  welcomeCopy: "Start a conversation.",
  welcomeEyebrowText: "Welcome",
  welcomeTitle: "Murmur",
};

function render(element: ReactElement): string {
  return renderToStaticMarkup(element);
}

function trigger(accessibilityLabel: string): void {
  const control = harness.controls.find((candidate) => candidate.accessibilityLabel === accessibilityLabel);
  expect(control).toBeDefined();
  control?.onPress?.();
}

function shellProps(params: {
  hasTimeline: boolean;
  isLive: boolean;
  translationMode: "continuous" | "phrase";
}): VariantShellProps {
  const committed = {
    ...createSpan("hello"),
    committed_translated_caption: "مرحبا",
    created_at_ms: new Date(2026, 6, 5, 9, 4, 7).getTime(),
    updated_at_ms: new Date(2026, 6, 5, 9, 4, 8).getTime(),
  };
  const partial = {
    ...createSpan("still listening"),
    partial_translated_caption: "ما زلت أستمع",
    status: "translating" as const,
  };
  const liveState = {
    error: "network_error",
    report_error: "translation_error",
    report_receipt_id: "receipt-123456",
    spans: params.hasTimeline ? [committed, partial] : [],
    status: params.isLive ? "live" as const : "ended" as const,
    tentative_source_caption: params.hasTimeline ? "tentative caption" : "",
  };
  const viewModel = buildHomeViewModel({
    live: liveState,
    sourceLanguageCode: "en",
    targetLanguageCode: "ar",
  });

  return {
    audioState: {
      audio_generation_id: 1,
      capture_active: params.isLive,
      dropped_frames: 0,
      event_seq: 1,
      playback_active: params.isLive,
      playback_queued_ms: 0,
      reason: params.isLive ? "active" : "idle",
      route: "speaker",
      sample_rate: 16000,
    },
    continuousAutoScrollRef: { current: true },
    continuousTimelineRef: { current: null },
    continuousUserInteractedRef: { current: false },
    live: liveState as VariantShellProps["live"],
    onOpenPicker: vi.fn(),
    onOpenSettings: vi.fn(),
    onPrimaryAction: vi.fn(),
    onSwapLanguages: vi.fn(),
    onToggleTranslationMode: vi.fn(),
    translationMode: params.translationMode,
    viewModel,
  };
}

function onboardingProps(step: VariantOnboardingProps["step"]): VariantOnboardingProps {
  return {
    canStart: true,
    onContinue: vi.fn(),
    onOpenPicker: vi.fn(),
    onPrivacyAgree: vi.fn(),
    onStart: vi.fn(),
    onTogglePrivacyConsent: vi.fn(),
    privacyConsentChecked: false,
    sourceLanguage: "English",
    step,
    targetLanguage: "Arabic",
  };
}

beforeEach(() => {
  harness.controls.length = 0;
  harness.scheme = "dark";
});

describe("Field Console variant", () => {
  it("renders phrase controls and wires language, settings, and mode actions", () => {
    const props = shellProps({ hasTimeline: false, isLive: false, translationMode: "phrase" });

    const markup = render(<FieldConsoleShell {...props} />);

    expect(markup).toContain("MURMUR");
    expect(markup).toContain("Ready to translate");
    expect(markup).toContain("LISTEN");
    expect(markup).toContain("Report received: receipt-");

    trigger("Open settings");
    trigger("Change spoken language");
    trigger("Change translation language");
    trigger("Reverse translation languages");
    for (const tab of harness.controls.filter((control) => control.accessibilityRole === "tab")) {
      tab.onPress?.();
    }

    expect(props.onOpenSettings).toHaveBeenCalledOnce();
    expect(props.onOpenPicker).toHaveBeenCalledWith("source");
    expect(props.onOpenPicker).toHaveBeenCalledWith("target");
    expect(props.onSwapLanguages).toHaveBeenCalledOnce();
    expect(props.onToggleTranslationMode).toHaveBeenCalledWith("phrase");
    expect(props.onToggleTranslationMode).toHaveBeenCalledWith("continuous");
  });

  it("renders committed, translating, and tentative entries in continuous mode", () => {
    const props = shellProps({ hasTimeline: true, isLive: true, translationMode: "continuous" });

    const markup = render(<FieldConsoleShell {...props} />);

    expect(markup).toContain("09:04:07");
    expect(markup).toContain("مرحبا");
    expect(markup).toContain("TRANSLATING");
    expect(markup).toContain("LISTENING");
    expect(markup).toContain("tentative caption");
    expect(markup).toContain("STOP");
  });
});

describe("shared variant onboarding flow", () => {
  it("renders each step and wires its primary actions", () => {
    const welcome = onboardingProps("welcome");
    expect(render(<OnboardingFlow {...welcome} text={onboardingText} theme={onboardingTheme} />)).toContain("Start a conversation.");
    harness.controls.find((control) => control.accessibilityRole === "button")?.onPress?.();
    expect(welcome.onContinue).toHaveBeenCalledOnce();

    harness.controls.length = 0;
    const privacy = onboardingProps("privacy");
    const privacyMarkup = render(<OnboardingFlow {...privacy} text={onboardingText} theme={onboardingTheme} />);
    expect(privacyMarkup).toContain("Murmur does not save audio or transcript history by default.");
    const consent = harness.controls.find((control) => control.accessibilityRole === "checkbox");
    expect(consent?.disabled).toBeUndefined();
    consent?.onPress?.();
    expect(privacy.onTogglePrivacyConsent).toHaveBeenCalledOnce();

    harness.controls.length = 0;
    const languages = onboardingProps("languages");
    const languagesMarkup = render(<OnboardingFlow {...languages} text={onboardingText} theme={onboardingTheme} />);
    expect(languagesMarkup).toContain("Choose languages");
    expect(languagesMarkup).toContain("English");
    expect(languagesMarkup).toContain("Arabic");
    for (const control of harness.controls.filter((candidate) => candidate.accessibilityRole === "button")) {
      control.onPress?.();
    }
    expect(languages.onOpenPicker).toHaveBeenCalledWith("source");
    expect(languages.onOpenPicker).toHaveBeenCalledWith("target");
    expect(languages.onStart).toHaveBeenCalledOnce();
  });
});

describe("continuous scroll behavior", () => {
  it("keeps following live text until a user scrolls away from the bottom", () => {
    const scrollToEnd = vi.fn();
    const refs = {
      continuousAutoScrollRef: { current: true },
      continuousTimelineRef: {
        current: { scrollToEnd } as unknown as NonNullable<
          VariantShellProps["continuousTimelineRef"]["current"]
        >,
      },
      continuousUserInteractedRef: { current: false },
    };
    const handlers = continuousScrollHandlers(refs);

    handlers.onContentSizeChange();
    handlers.onScrollBeginDrag();
    handlers.onScroll({
      nativeEvent: {
        contentInset: { bottom: 0, left: 0, right: 0, top: 0 },
        contentOffset: { x: 0, y: 100 },
        contentSize: { height: 1000, width: 400 },
        layoutMeasurement: { height: 600, width: 400 },
        zoomScale: 1,
      },
    } as Parameters<typeof handlers.onScroll>[0]);
    handlers.onContentSizeChange();

    expect(scrollToEnd).toHaveBeenCalledOnce();
    expect(refs.continuousAutoScrollRef.current).toBe(false);
    expect(refs.continuousUserInteractedRef.current).toBe(true);
  });
});
