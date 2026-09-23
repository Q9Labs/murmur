import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import reactNativeTestHarness from "../home/reactNativeTestHarness";

vi.mock("react-native", () => reactNativeTestHarness);
vi.mock("expo-localization", () => ({
  useLocales: () => [{ languageCode: "de", languageTag: "de-DE" }],
}));
vi.mock("../lib/observability/sentry", () => ({ captureMobileFailure: vi.fn() }));
vi.mock("./storage", () => ({
  deleteStoredUiLocalePreference: vi.fn(async () => undefined),
  getStoredUiLocalePreference: vi.fn(async () => "system"),
  setStoredUiLocalePreference: vi.fn(async () => undefined),
}));

import { syncDocumentLocale, UiLocaleOverride, UiLocaleProvider } from "./provider";
import { useUiLocale } from "./runtime";

function Probe() {
  const { direction, locale, preference, t } = useUiLocale();
  return <span>{`${locale}|${preference}|${direction}|${t("home.listen")}`}</span>;
}

describe("UI locale provider", () => {
  it("gates children until the saved preference has restored", () => {
    expect(renderToStaticMarkup(
      <UiLocaleProvider><span>ready</span></UiLocaleProvider>,
    )).toBe("");
  });

  it("syncs the browser language and direction from the exact UI locale", () => {
    const root = { dir: "ltr", lang: "en" };

    syncDocumentLocale("ur", root);

    expect(root).toEqual({ dir: "rtl", lang: "ur" });
  });

  it("renders a subtree in a fixed locale for previews", () => {
    const markup = renderToStaticMarkup(<UiLocaleOverride locale="ar"><Probe /></UiLocaleOverride>);
    expect(markup).toContain("ar|ar|rtl|");
    expect(markup).not.toContain("|Listen<");
  });
});
