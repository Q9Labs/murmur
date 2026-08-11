import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import reactNativeTestHarness from "./reactNativeTestHarness";

type CapturedControl = {
  accessibilityLabel?: string;
  accessibilityState?: {
    busy?: boolean;
    disabled?: boolean;
    selected?: boolean;
  };
  disabled?: boolean;
  onPress?: () => void;
};

const controls: CapturedControl[] = [];

vi.mock("react-native", () => ({
  ...reactNativeTestHarness,
  Pressable: ({
    accessibilityLabel,
    accessibilityState,
    children,
    disabled,
    onPress,
  }: CapturedControl & { children?: ReactNode }) => {
    controls.push({ accessibilityLabel, accessibilityState, disabled, onPress });
    return createElement("button", null, children);
  },
}));

vi.mock("./sheetStyles", () => ({
  useSheetStyles: () => ({ styles: {} }),
}));

import { AppLanguageList, type AppLanguageOption } from "./uiLanguageList";

const options: readonly AppLanguageOption[] = [
  { description: "Deutsch", id: "de", label: "German" },
  { accessibilityLabel: "Arabic language", description: "العربية", id: "ar", label: "Arabic" },
  { description: "English", id: "en", label: "English" },
];

function renderList(overrides: Partial<React.ComponentProps<typeof AppLanguageList>> = {}): string {
  return renderToStaticMarkup(
    <AppLanguageList
      direction="ltr"
      error={null}
      onSelect={vi.fn(async () => undefined)}
      options={options}
      selectedId="ar"
      {...overrides}
    />,
  );
}

beforeEach(() => {
  controls.length = 0;
});

describe("AppLanguageList", () => {
  it("keeps option order, selected check, and button accessibility state", () => {
    const markup = renderList();

    expect(markup.indexOf("German")).toBeLessThan(markup.indexOf("Arabic"));
    expect(markup.indexOf("Arabic")).toBeLessThan(markup.indexOf("English"));
    expect(markup.match(/✓/g)).toHaveLength(1);
    expect(controls).toHaveLength(3);
    expect(controls[0]).toMatchObject({
      accessibilityLabel: "German",
      accessibilityState: { busy: false, disabled: false, selected: false },
      disabled: false,
    });
    expect(controls[1]).toMatchObject({
      accessibilityLabel: "Arabic language",
      accessibilityState: { busy: false, disabled: false, selected: true },
      disabled: false,
    });
  });

  it("serializes one selection at a time and saves only after the write resolves", async () => {
    let resolveWrite!: () => void;
    const write = new Promise<void>((resolve) => {
      resolveWrite = resolve;
    });
    const onSelect = vi.fn(() => write);
    const onSaved = vi.fn();
    renderList({ onSaved, onSelect });

    controls[0].onPress?.();
    controls[1].onPress?.();
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith("de");
    expect(onSaved).not.toHaveBeenCalled();

    resolveWrite();
    await Promise.resolve();
    await Promise.resolve();
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  it("keeps the error visible and allows a retry after a rejected write", async () => {
    const onSelect = vi.fn().mockRejectedValue(new Error("network"));
    const onSaved = vi.fn();
    const markup = renderList({ error: "Could not save language.", onSaved, onSelect });

    expect(markup).toContain("Could not save language.");
    controls[0].onPress?.();
    await Promise.resolve();
    await Promise.resolve();
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSaved).not.toHaveBeenCalled();

    controls[0].onPress?.();
    await Promise.resolve();
    await Promise.resolve();
    expect(onSelect).toHaveBeenCalledTimes(2);
  });
});
