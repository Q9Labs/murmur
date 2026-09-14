import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({
  controls: [] as Array<{
    accessibilityLabel?: string;
    disabled?: boolean;
    onPress?: () => void;
  }>,
}));

vi.mock("react-native", () => ({
  Pressable: ({
    accessibilityLabel,
    children,
    disabled,
    onPress,
    style,
  }: {
    accessibilityLabel?: string;
    children?: ReactNode;
    disabled?: boolean;
    onPress?: () => void;
    style?: unknown;
  }) => {
    harness.controls.push({ accessibilityLabel, disabled, onPress });
    if (typeof style === "function") {
      style({ pressed: false });
    }
    return <button disabled={disabled}>{children}</button>;
  },
  Text: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  View: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

vi.mock("lucide-react-native", () => ({
  Mic: () => <span>mic</span>,
  Smartphone: () => <span>phone</span>,
}));

vi.mock("./styles", () => ({
  useBloomStyles: () => ({
    colors: { muted: "#777", primary: "#222" },
    styles: {},
  }),
}));

import { CaptureSourceControl } from "./captureSourceControl";

beforeEach(() => {
  harness.controls.length = 0;
});

describe("Bloom capture source control", () => {
  it("switches from the microphone to phone audio", () => {
    const onChange = vi.fn();
    const markup = renderToStaticMarkup(
      <CaptureSourceControl
        devicePlaybackSupported
        disabled={false}
        onChange={onChange}
        source="microphone"
      />,
    );

    expect(markup).toContain("Phone audio");
    harness.controls.find(
      (control) => control.accessibilityLabel === "Use phone audio input",
    )?.onPress?.();
    expect(onChange).toHaveBeenCalledWith("device_playback");
  });

  it("stays hidden when playback capture is unsupported", () => {
    const markup = renderToStaticMarkup(
      <CaptureSourceControl
        devicePlaybackSupported={false}
        disabled={false}
        onChange={vi.fn()}
        source="microphone"
      />,
    );

    expect(markup).toBe("");
  });
});
