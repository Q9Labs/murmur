import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import type { LiveTranslationController } from "../lib/useLiveTranslation";

vi.mock("react-native", () => ({
  Pressable: ({ children }: { children?: ReactNode }) => <button>{children}</button>,
  Text: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  View: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

vi.mock("./modalSheet", () => ({
  ModalSheet: ({ children, open }: { children?: ReactNode; open: boolean }) =>
    open ? <section>{children}</section> : null,
}));

vi.mock("./styles", () => ({ styles: {} }));

import { SettingsModal } from "./settingsModals";

function renderSettings(developerToolsEnabled: boolean): string {
  return renderToStaticMarkup(
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
    />,
  );
}

describe("settings sheet", () => {
  it("keeps developer tools out of production settings", () => {
    const markup = renderSettings(false);

    expect(markup).toContain("Share Murmur");
    expect(markup).toContain("Delete local data");
    expect(markup).not.toContain("Session diagnostics");
    expect(markup).not.toContain("Reset accountless identity");
  });

  it("shows internal controls in developer builds", () => {
    const markup = renderSettings(true);

    expect(markup).toContain("Session diagnostics");
    expect(markup).toContain("Reset accountless identity");
  });
});
