import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { resetRecorded, recorded } from "../../screens/__tests__/reactNativePrimitives";
import type { HomeViewModel } from "../viewModel";
import { TextLanguageRow } from "./sharedControls";

vi.mock("react-native", () =>
  import("../../screens/__tests__/reactNativePrimitives").then((module) => module.reactNativePrimitives),
);

const viewModel = {
  canChangeLanguages: true,
  canSwapLanguages: true,
  sourceLanguageDisplayName: "English",
  targetLanguageDisplayName: "Arabic",
} as HomeViewModel;

beforeEach(() => resetRecorded());

describe("TextLanguageRow", () => {
  it("allows language labels to wrap to two lines", () => {
    renderToStaticMarkup(
      <TextLanguageRow
        containerStyle={{ width: "100%" }}
        labelStyle={{ flex: 1, minWidth: 0 }}
        onOpenPicker={vi.fn()}
        onSwapLanguages={vi.fn()}
        pressedStyle={{ opacity: 0.5 }}
        swapGlyph="⇄"
        swapStyle={{ fontSize: 18 }}
        textStyle={{ fontSize: 15 }}
        viewModel={viewModel}
      />,
    );

    const languageLabels = recorded.texts.filter(
      ({ content }) => content === "English" || content === "Arabic",
    );
    expect(languageLabels.map(({ numberOfLines }) => numberOfLines)).toEqual([2, 2]);
  });
});
