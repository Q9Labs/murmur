import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { TranslationSpan } from "@murmur/protocol/session";

import type { LiveTranslationController } from "../lib/useLiveTranslation";
import reactNativeTestHarness from "./reactNativeTestHarness";
import { TranslationReportActions } from "./reportTranslation";

vi.mock("react-native", () => reactNativeTestHarness);
vi.mock("./styles", () => ({
  styles: {
    reportButton: {},
    reportButtonText: {},
    reportRow: {},
  },
}));

const committedSpan = {
  committed_translated_caption: "Hola",
  created_at_ms: 1,
  partial_translated_caption: null,
  provider_metadata: null,
  source_caption: "Hello",
  span_id: "span-1",
  revision: 1,
  status: "committed",
  translated_caption: "Hola",
  updated_at_ms: 2,
} as const satisfies TranslationSpan;

beforeEach(() => {
  reactNativeTestHarness.controls.length = 0;
});

describe("translation report actions", () => {
  it("reports a committed span with each supported category", () => {
    const live = { reportSpan: vi.fn(async () => undefined) } as unknown as LiveTranslationController;
    const markup = renderToStaticMarkup(
      <TranslationReportActions live={live} span={committedSpan} />,
    );

    expect(markup).toContain("Inaccurate");
    expect(markup).toContain("Wrong language");
    expect(reactNativeTestHarness.controls).toHaveLength(5);
    for (const control of reactNativeTestHarness.controls) {
      control.onPress?.();
    }
    expect(live.reportSpan).toHaveBeenNthCalledWith(1, committedSpan, "inaccurate");
    expect(live.reportSpan).toHaveBeenNthCalledWith(5, committedSpan, "other");
  });

  it("does not offer report actions for an incomplete span", () => {
    const live = { reportSpan: vi.fn(async () => undefined) } as unknown as LiveTranslationController;
    const partialSpan = {
      ...committedSpan,
      committed_translated_caption: null,
      status: "translating" as const,
    };

    expect(
      renderToStaticMarkup(<TranslationReportActions live={live} span={partialSpan} />),
    ).toBe("");
    expect(reactNativeTestHarness.controls).toHaveLength(0);
  });
});
