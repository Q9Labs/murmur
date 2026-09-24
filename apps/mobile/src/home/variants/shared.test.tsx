import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { recorded, resetRecorded } from "../../screens/__tests__/reactNativePrimitives";
import type { LiveTranslationController } from "../../lib/useLiveTranslation";
import type { HomeViewModel } from "../viewModel";
import { SpanTimeline } from "./shared";

vi.mock("react-native", () =>
  import("../../screens/__tests__/reactNativePrimitives").then((module) => module.reactNativePrimitives),
);
vi.mock("posthog-react-native", () => ({
  PostHogMaskView: ({ children }: { children?: ReactNode }) => children ?? null,
}));

beforeEach(() => resetRecorded());

describe("SpanTimeline empty state", () => {
  it("allows the translation instruction to wrap to two lines", () => {
    const live = {
      source_transcript_enabled: false,
      spans: [],
      tentative_source_caption: "",
    } as unknown as LiveTranslationController;
    const viewModel = {
      isLive: false,
      targetLanguage: { rtl: false },
      targetLanguageDisplayName: "Arabic",
    } as HomeViewModel;

    renderToStaticMarkup(
      <SpanTimeline
        autoScrollRef={{ current: true }}
        live={live}
        textStyles={{ partial: {}, rtl: {}, source: {}, translation: {} }}
        timelineRef={{ current: null }}
        userInteractedRef={{ current: false }}
        viewModel={viewModel}
      />,
    );

    expect(recorded.texts).toContainEqual({
      content: "Tap Listen and hear the room in Arabic.",
      numberOfLines: 2,
    });
  });
});
