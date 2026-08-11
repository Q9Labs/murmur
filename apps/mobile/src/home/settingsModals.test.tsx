import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import type { LiveTranslationController } from "../lib/useLiveTranslation";
import { createTranslator, UiLocaleContext, type UiLocaleContextValue } from "../i18n/runtime";
import reactNativeTestHarness from "./reactNativeTestHarness";

vi.mock("react-native", () => reactNativeTestHarness);

vi.mock("./modalSheet", () => ({
  ModalSheet: ({ children, open, title }: { children?: ReactNode; open: boolean; title: string }) => {
    if (!open) {
      return null;
    }
    return <article><h1>{title}</h1>{children}</article>;
  },
}));

vi.mock("./sheetStyles", () => ({
  useSheetStyles: () => ({ colors: { muted: "#8D8494" }, styles: {} }),
}));

vi.mock("expo-linking", () => ({ openURL: vi.fn() }));

vi.mock("lucide-react-native", () => ({
  ChevronRight: () => <span>chevron</span>,
}));

import { SettingsModal } from "./settingsModals";

function renderSettings(
  developerToolsEnabled: boolean,
  localeContext?: UiLocaleContextValue,
): string {
  const settings = (
    <SettingsModal
      developerToolsEnabled={developerToolsEnabled}
      live={{ status: "idle" } as LiveTranslationController}
      onClose={vi.fn()}
      onDeleteLocalData={vi.fn()}
      onOpenDiagnostics={vi.fn()}
      onResetIdentity={vi.fn()}
      onShare={vi.fn()}
      open
      settingsMessage={null}
    />
  );
  return renderToStaticMarkup(
    localeContext ? (
      <UiLocaleContext.Provider value={localeContext}>{settings}</UiLocaleContext.Provider>
    ) : settings,
  );
}

describe("settings sheet", () => {
  it("keeps developer tools out of production settings", () => {
    const markup = renderSettings(false);

    expect(markup).toContain("Share Murmur");
    expect(markup).toContain("App language");
    expect(markup).toContain("Privacy policy");
    expect(markup).toContain("Terms of use");
    expect(markup).toContain("Support &amp; data requests");
    expect(markup).toContain("Delete local data");
    expect(markup).toContain("Report translation");
    expect(markup).toContain("Reset Murmur Identity");
    expect(markup).not.toContain("Session diagnostics");
  });

  it("shows internal controls in developer builds", () => {
    const markup = renderSettings(true);

    expect(markup).toContain("Session diagnostics");
    expect(markup).toContain("Reset Murmur Identity");
    expect(markup).not.toContain("Report translation");
  });

  it("renders settings copy from the Arabic catalog", () => {
    const translate = createTranslator("ar");
    const markup = renderSettings(false, {
      deleteLocale: vi.fn(async () => undefined),
      direction: "rtl",
      locale: "ar",
      ready: true,
      setLocale: vi.fn(async () => undefined),
      t: translate,
      translate,
    });

    expect(markup).toContain("الإعدادات");
    expect(markup).toContain("لغة التطبيق");
    expect(markup).toContain("مشاركة \u2068Murmur\u2069");
    expect(markup).toContain("العربية");
  });
});
