import { describe, expect, it, vi } from "vitest";

vi.mock("expo-router", () => ({
  Redirect: () => null,
  useLocalSearchParams: () => ({}),
}));

vi.mock("../src/home/preview", () => ({
  BloomPreview: () => null,
}));

import { normalizePreviewLocale, normalizePreviewScreen } from "./preview";

describe("preview route", () => {
  it("selects only supported deterministic screens", () => {
    expect(normalizePreviewScreen("languages")).toBe("languages");
    expect(normalizePreviewScreen("picker")).toBe("picker");
    expect(normalizePreviewScreen("privacy")).toBe("privacy");
    expect(normalizePreviewScreen("settings")).toBe("settings");
    expect(normalizePreviewScreen("source-picker")).toBe("source-picker");
    expect(normalizePreviewScreen("translation")).toBe("translation");
    expect(normalizePreviewScreen("translation-muted")).toBe("translation-muted");
    expect(normalizePreviewScreen("translation-only")).toBe("translation-only");
    expect(normalizePreviewScreen("out-of-minutes")).toBe("out-of-minutes");
    expect(normalizePreviewScreen("out-of-minutes-signed-in")).toBe("out-of-minutes-signed-in");
    expect(normalizePreviewScreen("low-balance")).toBe("low-balance");
    expect(normalizePreviewScreen("update-required")).toBe("update-required");
    expect(normalizePreviewScreen(["welcome"])).toBe("welcome");
    expect(normalizePreviewScreen("unknown")).toBe("welcome");
    expect(normalizePreviewScreen(undefined)).toBe("welcome");
  });

  it("renders previews in a requested UI language", () => {
    expect(normalizePreviewLocale("ar")).toBe("ar");
    expect(normalizePreviewLocale(["pt-BR"])).toBe("pt-BR");
    expect(normalizePreviewLocale("xx")).toBeNull();
    expect(normalizePreviewLocale(undefined)).toBeNull();
  });
});
