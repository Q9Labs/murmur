import { describe, expect, it, vi } from "vitest";

async function loadFor(os: string): Promise<string | undefined> {
  vi.resetModules();
  vi.doMock("react-native", () => ({
    Platform: { OS: os, select: (choices: Record<string, string>) => choices[os] },
  }));
  const module = await import("./serifFont");
  return module.serifFontFamily;
}

describe("serifFontFamily", () => {
  it("uses Georgia on iOS", async () => {
    expect(await loadFor("ios")).toBe("Georgia");
  });
  it("uses the generic serif family on Android", async () => {
    expect(await loadFor("android")).toBe("serif");
  });
  it("falls back to the platform default elsewhere", async () => {
    expect(await loadFor("web")).toBeUndefined();
  });
});
