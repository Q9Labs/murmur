import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { LiveTranslationController } from "../lib/useLiveTranslation";
import reactNativeTestHarness from "./reactNativeTestHarness";
import { TranslationReportModal } from "./experience";

vi.mock("react-native", () => reactNativeTestHarness);

vi.mock("./diagnosticsModal", () => ({ DiagnosticsModal: () => null }));
vi.mock("./languagePicker", () => ({ LanguagePickerController: () => null }));
vi.mock("./modalSheet", () => ({
  ModalSheet: ({ children, open, title }: { children?: ReactNode; open: boolean; title: string }) =>
    open ? <section><h1>{title}</h1>{children}</section> : null,
}));
vi.mock("./settingsModals", () => ({ SettingsModal: () => null }));
vi.mock("./styles", () => ({
  styles: {
    reportButton: {},
    reportButtonText: {},
    reportRow: {},
    rtlText: {},
    spanRow: {},
    spanSource: {},
    spanTranslation: {},
    timeline: {},
    timelineEmpty: {},
  },
}));
vi.mock("./variants/bloom", () => ({ BloomShell: () => null }));

function createLive(): LiveTranslationController {
  const reportSpan = vi.fn(async () => undefined);
  return {
    reportSpan,
    spans: [
      {
        committed_translated_caption: "Hola",
        source_caption: "Hello",
        span_id: "committed-span",
        revision: 1,
        status: "committed",
        translated_caption: "Hola",
      },
      {
        committed_translated_caption: null,
        source_caption: "Still speaking",
        span_id: "partial-span",
        revision: 1,
        status: "translating",
        translated_caption: "",
      },
    ],
  } as unknown as LiveTranslationController;
}

beforeEach(() => {
  reactNativeTestHarness.controls.length = 0;
});

describe("production translation reporting", () => {
  it("shows report actions only for committed spans", () => {
    const live = createLive();
    const markup = renderToStaticMarkup(
      <TranslationReportModal live={live} onClose={vi.fn()} open targetLanguageRtl={false} />,
    );

    expect(markup).toContain("Report translation");
    expect(markup).toContain("Hello");
    expect(markup).toContain("Hola");
    expect(markup).not.toContain("Still speaking");
    expect(reactNativeTestHarness.controls).toHaveLength(5);

    for (const control of reactNativeTestHarness.controls) {
      control.onPress?.();
    }
    expect(live.reportSpan).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ span_id: "committed-span" }),
      "inaccurate",
    );
    expect(live.reportSpan).toHaveBeenNthCalledWith(
      5,
      expect.objectContaining({ span_id: "committed-span" }),
      "other",
    );
  });

  it("explains when a session has nothing to report", () => {
    const live = { spans: [] } as unknown as LiveTranslationController;

    expect(
      renderToStaticMarkup(
        <TranslationReportModal live={live} onClose={vi.fn()} open targetLanguageRtl={false} />,
      ),
    ).toContain("No committed translations yet.");
  });
});
