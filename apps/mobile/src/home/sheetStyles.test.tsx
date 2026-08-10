import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({ scheme: "light" as "dark" | "light" }));

vi.mock("react-native", () => ({
  StyleSheet: {
    absoluteFillObject: {},
    create: <T,>(styles: T) => styles,
  },
  useColorScheme: () => harness.scheme,
}));

import { useSheetStyles } from "./sheetStyles";

beforeEach(() => {
  harness.scheme = "light";
});

function ThemeProbe(): string {
  const { colors } = useSheetStyles();
  return `${colors.dark ? "dark" : "light"}:${colors.surface}`;
}

describe("sheet styles", () => {
  it("follows the light system appearance", () => {
    expect(renderToStaticMarkup(<ThemeProbe />)).toContain("light:#FFFDF9");
  });

  it("follows the dark system appearance", () => {
    harness.scheme = "dark";
    expect(renderToStaticMarkup(<ThemeProbe />)).toContain("dark:#211B24");
  });
});
