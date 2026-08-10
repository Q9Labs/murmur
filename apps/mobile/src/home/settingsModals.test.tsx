import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { LiveTranslationController } from "../lib/useLiveTranslation";

const harness = vi.hoisted(() => ({
  onValueChange: null as ((enabled: boolean) => void) | null,
}));

vi.mock("react-native", () => ({
  Pressable: ({ children }: { children?: ReactNode }) => <button>{children}</button>,
  Switch: ({ onValueChange }: { onValueChange: (enabled: boolean) => void }) => {
    harness.onValueChange = onValueChange;
    return <input readOnly type="checkbox" />;
  },
  Text: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  View: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

vi.mock("./modalSheet", () => ({
  ModalSheet: ({ children, open }: { children?: ReactNode; open: boolean }) =>
    open ? <section>{children}</section> : null,
}));

vi.mock("./styles", () => ({ styles: {} }));

import { SettingsModal } from "./settingsModals";

beforeEach(() => {
  harness.onValueChange = null;
});

function renderSettings(developerToolsEnabled: boolean): string {
  return renderToStaticMarkup(
    <SettingsModal
      audioPlaybackEnabled
      developerToolsEnabled={developerToolsEnabled}
      live={{ status: "idle" } as LiveTranslationController}
      onAudioPlaybackEnabledChange={vi.fn()}
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

    expect(markup).toContain("Play translated audio");
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
