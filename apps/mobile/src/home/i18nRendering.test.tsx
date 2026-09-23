import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createSpan } from "@murmur/protocol/session";
import { createTranslator, UiLocaleContext, type UiLocaleContextValue } from "../i18n/runtime";

const capturedText: Array<{ children: ReactNode; style: unknown }> = [];

vi.mock("posthog-react-native", () => ({
  PostHogMaskView: ({ children }: { children?: ReactNode }) => children ?? null,
}));

vi.mock("react-native", () => ({
  ScrollView: ({ children }: { children?: ReactNode }) => createElement("div", null, children),
  Text: ({ children, style }: { children?: ReactNode; style?: unknown }) => {
    capturedText.push({ children, style });
    return createElement("span", null, children);
  },
  View: ({ children }: { children?: ReactNode }) => createElement("div", null, children),
}));

vi.mock("./styles", () => ({
  styles: {
    autoText: { textAlign: "auto", writingDirection: "auto" },
    ltrText: { textAlign: "left", writingDirection: "ltr" },
    rtlText: { textAlign: "right", writingDirection: "rtl" },
  },
}));

import { SpanTimeline } from "./variants/shared";

const arabicTranslate = createTranslator("ar");
const arabicContext: UiLocaleContextValue = {
  deleteLocale: vi.fn(async () => undefined),
  direction: "rtl",
  locale: "ar",
  ready: true,
  preference: "ar",
  setPreference: vi.fn(async () => undefined),
  t: arabicTranslate,
  translate: arabicTranslate,
};
const ltrText = { textAlign: "left", writingDirection: "ltr" } as const;
const rtlText = { textAlign: "right", writingDirection: "rtl" } as const;

beforeEach(() => {
  capturedText.length = 0;
});

function renderTimeline(live: unknown, viewModel: unknown): string {
  return renderToStaticMarkup(
    <UiLocaleContext.Provider value={arabicContext}>
      <SpanTimeline
        autoScrollRef={{ current: true }}
        live={live as never}
        textStyles={{ ltr: ltrText, partial: {}, rtl: rtlText, source: {}, translation: {} }}
        timelineRef={{ current: null }}
        userInteractedRef={{ current: false }}
        viewModel={viewModel as never}
      />
    </UiLocaleContext.Provider>,
  );
}

describe("Arabic UI rendering", () => {
  it("keeps English source text LTR and Arabic translation text RTL", () => {
    const span = {
      ...createSpan("Hello"),
      committed_translated_caption: "مرحبًا",
      status: "committed" as const,
    };

    renderTimeline(
      { source_transcript_enabled: true, spans: [span], tentative_source_caption: "" },
      { isLive: false, sourceLanguage: { rtl: false }, targetLanguage: { rtl: true } },
    );

    expect(capturedText.find(({ children }) => children === "Hello")?.style).toContain(ltrText);
    expect(capturedText.find(({ children }) => children === "مرحبًا")?.style).toContain(rtlText);
  });

  it("uses Arabic shell copy for an empty timeline", () => {
    const markup = renderTimeline(
      { spans: [], tentative_source_caption: "" },
      { isLive: false, sourceLanguage: { rtl: false }, targetLanguage: { rtl: true } },
    );

    expect(markup).toContain("ستظهر المحادثة هنا بعد البدء.");
  });

  it("lets auto-detected source text derive its direction from content", () => {
    const span = {
      ...createSpan("مرحبًا"),
      committed_translated_caption: "Hello",
      status: "committed" as const,
    };

    renderTimeline(
      { source_transcript_enabled: true, spans: [span], tentative_source_caption: "" },
      { isLive: false, sourceLanguage: null, targetLanguage: { rtl: false } },
    );

    expect(capturedText.find(({ children }) => children === "مرحبًا")?.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ textAlign: "auto", writingDirection: "auto" }),
      ]),
    );
  });
});
