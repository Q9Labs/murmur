import { describe, expect, it, vi } from "vitest";

vi.mock("react-native", () => ({
  useColorScheme: () => "light",
}));

import { darkMurmurTheme, lightMurmurTheme, resolveMurmurTheme } from "./theme";

describe("Murmur theme", () => {
  it("follows the system dark appearance", () => {
    expect(resolveMurmurTheme("dark")).toBe(darkMurmurTheme);
  });

  it("uses the light theme when the system has no preference", () => {
    expect(resolveMurmurTheme(null)).toBe(lightMurmurTheme);
    expect(resolveMurmurTheme("light")).toBe(lightMurmurTheme);
  });
});
