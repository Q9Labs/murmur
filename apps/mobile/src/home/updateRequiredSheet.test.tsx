import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({
  controls: [] as Array<{ accessibilityRole?: string; onPress?: () => void }>,
  openURL: vi.fn(async () => true),
}));

vi.mock("react-native", () => ({
  Image: () => null,
  Platform: { OS: "ios" },
  Pressable: ({
    accessibilityRole,
    children,
    onPress,
    style,
  }: {
    accessibilityRole?: string;
    children?: ReactNode;
    onPress?: () => void;
    style?: unknown;
  }) => {
    harness.controls.push({ accessibilityRole, onPress });
    if (typeof style === "function") {
      style({ pressed: false });
    }
    return <button>{children}</button>;
  },
  StyleSheet: { create: <T,>(styles: T): T => styles },
  Text: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  useColorScheme: () => "dark",
}));
vi.mock("expo-constants", () => ({
  default: {
    expoConfig: {
      android: { playStoreUrl: "https://play.google.com/store/apps/details?id=com.q9labsai.murmur" },
      ios: { appStoreUrl: "https://apps.apple.com/app/id6756962206" },
    },
  },
}));
vi.mock("expo-linking", () => ({ openURL: harness.openURL }));
vi.mock("../lib/observability/sentry", () => ({ captureMobileFailure: vi.fn() }));
vi.mock("./modalSheet", () => import("./__tests__/modalSheetMock"));
vi.mock("./illustrations", () => ({ updateRequiredIllustration: 1 }));

import { storeListing, UpdateRequiredSheet } from "./updateRequiredSheet";

const config = {
  android: { playStoreUrl: "https://play.google.com/store/apps/details?id=com.q9labsai.murmur" },
  ios: { appStoreUrl: "https://apps.apple.com/app/id6756962206" },
};

beforeEach(() => {
  harness.controls.length = 0;
  harness.openURL.mockClear();
});

describe("update-required sheet", () => {
  it("links each platform to its own store listing", () => {
    expect(storeListing("ios", config)).toEqual({
      label: "update.appStore",
      url: "https://apps.apple.com/app/id6756962206",
    });
    expect(storeListing("android", config)).toEqual({
      label: "update.googlePlay",
      url: "https://play.google.com/store/apps/details?id=com.q9labsai.murmur",
    });
    expect(storeListing("web", config)).toBeNull();
    expect(storeListing("ios", null)).toBeNull();
  });

  it("opens the App Store listing from the update button", () => {
    const markup = renderToStaticMarkup(<UpdateRequiredSheet onClose={vi.fn()} open />);

    expect(markup).toContain("Update Murmur");
    expect(markup).toContain("Update in the App Store");
    harness.controls.find((control) => control.accessibilityRole === "link")?.onPress?.();
    expect(harness.openURL).toHaveBeenCalledWith("https://apps.apple.com/app/id6756962206");
  });
});
