import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import reactNativeTestHarness from "../home/reactNativeTestHarness";

vi.mock("react-native", () => reactNativeTestHarness);
vi.mock("./storage", () => ({
  deleteStoredUiLocale: vi.fn(async () => undefined),
  getStoredUiLocale: vi.fn(async () => "en"),
  setStoredUiLocale: vi.fn(async () => undefined),
}));

import { syncDocumentLocale, UiLocaleProvider } from "./provider";

describe("UI locale provider", () => {
  it("gates children until the saved locale has restored", () => {
    expect(renderToStaticMarkup(
      <UiLocaleProvider><span>ready</span></UiLocaleProvider>,
    )).toBe("");
  });

  it("syncs the browser language and direction from the exact UI locale", () => {
    const root = { dir: "ltr", lang: "en" };

    syncDocumentLocale("ar", root);

    expect(root).toEqual({ dir: "rtl", lang: "ar" });
  });
});
