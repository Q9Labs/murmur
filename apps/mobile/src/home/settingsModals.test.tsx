import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import type { LiveTranslationController } from "../lib/useLiveTranslation";
import reactNativeTestHarness from "./reactNativeTestHarness";

vi.mock("react-native", () => reactNativeTestHarness);

vi.mock("./modalSheet", () => ({
  ModalSheet: ({ children, open }: { children?: ReactNode; open: boolean }) =>
    open ? <section>{children}</section> : null,
}));

vi.mock("./sheetStyles", () => ({
  useSheetStyles: () => ({ colors: { muted: "#8D8494" }, styles: {} }),
}));

vi.mock("expo-linking", () => ({ openURL: vi.fn() }));

vi.mock("lucide-react-native", () => ({
  ChevronRight: () => <span>chevron</span>,
}));

import { SettingsModal } from "./settingsModals";

function renderSettings(developerToolsEnabled: boolean): string {
  return renderToStaticMarkup(
    <SettingsModal
      anonymousAnalyticsEnabled
      developerToolsEnabled={developerToolsEnabled}
      live={{ status: "idle" } as LiveTranslationController}
      onClose={vi.fn()}
      onAnonymousAnalyticsEnabledChange={vi.fn()}
      onDeleteLocalData={vi.fn()}
      onOpenDiagnostics={vi.fn()}
      onResetIdentity={vi.fn()}
      onShare={vi.fn()}
      open
      settingsMessage={null}
    />,
  );
}

describe("settings sheet", () => {
  it("keeps developer tools out of production settings", () => {
    const markup = renderSettings(false);

    expect(markup).toContain("Share Murmur");
    expect(markup).toContain("Anonymous analytics: On");
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
});
