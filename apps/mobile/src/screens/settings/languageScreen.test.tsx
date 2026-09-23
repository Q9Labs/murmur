import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTranslator, UiLocaleContext, type UiLocaleContextValue } from "../../i18n/runtime";
import type { UiLocale, UiLocalePreference } from "../../i18n/types";
import { findControl, recorded, resetRecorded } from "../__tests__/reactNativePrimitives";

const sentry = vi.hoisted(() => ({ captureMobileFailure: vi.fn() }));

vi.mock("react-native", () => import("../__tests__/reactNativePrimitives").then((m) => m.reactNativePrimitives));
vi.mock("lucide-react-native", () => import("../__tests__/navigation").then((m) => m.lucideMock));
vi.mock("../screenScaffold", () => import("../__tests__/scaffoldMock"));
vi.mock("../../lib/observability/sentry", () => sentry);

import { LanguageScreen } from "./languageScreen";

function render(preference: UiLocalePreference, locale: UiLocale, setPreference = vi.fn(async () => undefined)) {
  const value: UiLocaleContextValue = {
    deleteLocale: vi.fn(async () => undefined),
    direction: locale === "ar" || locale === "ur" ? "rtl" : "ltr",
    locale,
    preference,
    ready: true,
    setPreference,
    t: createTranslator(locale),
    translate: createTranslator(locale),
  };
  const markup = renderToStaticMarkup(
    <UiLocaleContext.Provider value={value}>
      <LanguageScreen />
    </UiLocaleContext.Provider>,
  );
  return { markup, setPreference };
}

beforeEach(() => {
  resetRecorded();
  vi.clearAllMocks();
});

describe("app language screen", () => {
  it("lists System default first, then each language in its own name", () => {
    render("system", "en");

    const labels = recorded.controls.map((control) => control.accessibilityLabel);
    expect(labels[0]).toBe("System default");
    expect(labels).toEqual(expect.arrayContaining(["العربية", "हिन्दी", "日本語", "Deutsch", "اردو", "Türkçe"]));
    expect(labels).toHaveLength(12);
    expect(findControl("System default")?.accessibilityState?.selected).toBe(true);
  });

  it("marks the chosen language and switches instantly", () => {
    const { setPreference } = render("de", "de");

    expect(findControl("Deutsch")?.accessibilityState?.selected).toBe(true);
    expect(findControl("Systemsprache")?.accessibilityState?.selected).toBe(false);
    findControl("日本語")?.onPress?.();
    expect(setPreference).toHaveBeenCalledWith("ja");
  });

  it("reports a failed save", async () => {
    const failure = new Error("storage unavailable");
    render("system", "en", vi.fn(async () => {
      throw failure;
    }));

    findControl("Español")?.onPress?.();
    await vi.waitFor(() => {
      expect(sentry.captureMobileFailure).toHaveBeenCalledWith(failure, {
        operation: "save_ui_locale",
        stage: "settings",
      });
    });
  });
});
