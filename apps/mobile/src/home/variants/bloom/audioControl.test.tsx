import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({
  controls: [] as Array<{
    accessibilityLabel?: string;
    onPress?: () => void;
  }>,
}));

vi.mock("react-native", () => ({
  Pressable: ({
    accessibilityLabel,
    children,
    onPress,
    style,
  }: {
    accessibilityLabel?: string;
    children?: ReactNode;
    onPress?: () => void;
    style?: unknown;
  }) => {
    harness.controls.push({ accessibilityLabel, onPress });
    if (typeof style === "function") {
      style({ pressed: false });
    }
    return <button>{children}</button>;
  },
  View: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

vi.mock("lucide-react-native", () => ({
  Volume2: () => <span>volume-on</span>,
  VolumeX: () => <span>volume-off</span>,
}));

vi.mock("./styles", () => ({
  useBloomStyles: () => ({ colors: { primary: "#3A2E3F" }, styles: {} }),
}));

import { TranslatedAudioControl } from "./audioControl";

beforeEach(() => {
  harness.controls.length = 0;
});

function renderControl(enabled: boolean): (enabled: boolean) => void {
  const onChange = vi.fn();
  renderToStaticMarkup(<TranslatedAudioControl enabled={enabled} onChange={onChange} />);
  return onChange;
}

describe("Bloom translated audio control", () => {
  it("turns playback off without stopping captions", () => {
    const onChange = renderControl(true);
    const control = harness.controls.find(
      (candidate) => candidate.accessibilityLabel === "Turn translated audio off",
    );

    expect(control).toBeDefined();
    expect(renderToStaticMarkup(<TranslatedAudioControl enabled onChange={vi.fn()} />)).toContain(
      "volume-on",
    );
    control?.onPress?.();
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it("offers to restore playback when audio is off", () => {
    const markup = renderToStaticMarkup(
      <TranslatedAudioControl enabled={false} onChange={vi.fn()} />,
    );

    expect(harness.controls).toContainEqual(expect.objectContaining({
      accessibilityLabel: "Turn translated audio on",
    }));
    expect(markup).toContain("volume-off");
  });
});
