import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { BloomOnboarding } from "./onboarding";
import type { VariantOnboardingProps } from "../types";

// The approved spec fills spare vertical space between the grouped content and
// the footer (.wf-fill flex:1), so the action footer must consume the free
// space itself rather than relying on space-between, which would separate the
// heading and example card from each other.
const harness = vi.hoisted(() => ({
  scrollContentStyles: [] as Array<Record<string, unknown>>,
  texts: [] as Array<{ role?: string; style: Record<string, unknown> | undefined; value?: unknown }>,
  views: [] as Array<Record<string, unknown> | undefined>,
}));

vi.mock("react-native", () => {
  function flattenStyle(style: unknown): Record<string, unknown> | undefined {
    if (Array.isArray(style)) {
      return Object.assign({}, ...style.filter(Boolean).map((entry) => flattenStyle(entry)));
    }
    return (style as Record<string, unknown>) ?? undefined;
  }

  function View({ children, style }: { children?: ReactNode; style?: unknown }): ReactNode {
    const flat = flattenStyle(style);
    harness.views.push(flat);
    return <div>{children}</div>;
  }

  function ScrollView({ children, contentContainerStyle }: { children?: ReactNode; contentContainerStyle?: unknown }): ReactNode {
    harness.scrollContentStyles.push(flattenStyle(contentContainerStyle) ?? {});
    return <div>{children}</div>;
  }

  return {
    Platform: { OS: "ios", select: (options: Record<string, unknown>) => options.ios ?? options.default },
    useColorScheme: () => "light",
    Pressable: ({ children }: { children?: ReactNode }) => <button>{children}</button>,
    ScrollView,
    StatusBar: () => null,
    StyleSheet: { create: <T,>(styles: T): T => styles },
    Text: ({ accessibilityRole, children, style }: { accessibilityRole?: string; children?: ReactNode; style?: unknown }) => {
      harness.texts.push({ role: accessibilityRole, style: flattenStyle(style), value: children });
      return <span>{children}</span>;
    },
    View,
  };
});

vi.mock("react-native-safe-area-context", () => ({
  SafeAreaView: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

vi.mock("lucide-react-native", () => ({
  AudioLines: () => <span />,
  ChartNoAxesColumn: () => <span />,
  ShieldCheck: () => <span />,
}));

vi.mock("../../../i18n/runtime", () => ({
  formatUiNumber: (value: number) => String(value),
  uiContentDirectionStyle: () => ({}),
  uiTextDirectionStyle: () => ({}),
  useUiLocale: () => ({ direction: "ltr", locale: "en", t: (key: string) => key }),
}));

vi.mock("../../../lib/legalLinks", () => ({ openLegalLink: vi.fn() }));

vi.mock("./index", () => ({
  BrandMark: () => <span>brand</span>,
  BreathingBlob: () => <span>blob</span>,
}));

const baseProps: VariantOnboardingProps = {
  canStart: true,
  captureSource: "microphone",
  devicePlaybackSupported: false,
  onAlreadySubscribed: vi.fn(),
  onContinue: vi.fn(),
  onCaptureSourceChange: vi.fn(),
  onOpenPicker: vi.fn(),
  onPrivacyAgree: vi.fn(),
  onStart: vi.fn(),
  onTogglePrivacyConsent: vi.fn(),
  privacyConsentChecked: true,
  sourceLanguage: "English",
  step: "welcome",
  targetLanguage: "Spanish",
};

function renderStep(step: VariantOnboardingProps["step"], overrides?: Partial<VariantOnboardingProps>): string {
  return renderToStaticMarkup(<BloomOnboarding {...baseProps} step={step} {...overrides} />);
}

beforeEach(() => {
  harness.scrollContentStyles.length = 0;
  harness.texts.length = 0;
  harness.views.length = 0;
});

describe("Bloom onboarding layout contract", () => {
  it("keeps the scroll container flexible without space-between and anchors the footer with marginTop:auto", () => {
    const markup = renderStep("welcome");
    const [scrollStyle] = harness.scrollContentStyles;
    expect(scrollStyle.flexGrow).toBe(1);
    expect(scrollStyle.justifyContent).toBeUndefined();

    // The footer renders as the last view in the scroll body and must own the
    // free vertical space via marginTop:auto so content stays grouped on top.
    const lastView = harness.views.at(-1);
    expect(lastView?.marginTop).toBe("auto");
    expect(markup).toContain("onboarding.getStarted");
    expect(markup).toContain("onboarding.alreadySubscribed");
  });

  it("renders the consent failure notice only on the privacy step as a non-flex alert", () => {
    const notice = "Your choice wasn't saved. Try again.";
    for (const step of ["welcome", "privacy", "languages"] as const) {
      harness.scrollContentStyles.length = 0;
      harness.texts.length = 0;
      harness.views.length = 0;
      renderStep(step, { privacyNotice: notice });
      const alerts = harness.texts.filter((entry) => entry.role === "alert");
      if (step === "privacy") {
        expect(alerts).toHaveLength(1);
        expect(alerts[0].value).toBe(notice);
        expect(alerts[0].style?.flex).toBeUndefined();
      } else {
        expect(alerts, `${step} must not show the privacy notice`).toHaveLength(0);
      }
    }
  });

  it("applies the same bottom-anchored footer on the privacy and languages steps", () => {
    for (const step of ["privacy", "languages"] as const) {
      harness.scrollContentStyles.length = 0;
      harness.views.length = 0;
      renderStep(step);
      const lastView = harness.views.at(-1);
      expect(lastView?.marginTop, `${step} footer anchor`).toBe("auto");
    }
  });
});
