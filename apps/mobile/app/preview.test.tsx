import { describe, expect, it, vi } from "vitest";

vi.mock("expo-router", () => ({
  Redirect: () => null,
  useLocalSearchParams: () => ({}),
}));

vi.mock("../src/home/preview", () => ({
  BloomPreview: () => null,
}));

import { normalizePreviewScreen } from "./preview";

describe("preview route", () => {
  it("selects only supported deterministic screens", () => {
    expect(normalizePreviewScreen("languages")).toBe("languages");
    expect(normalizePreviewScreen("picker")).toBe("picker");
    expect(normalizePreviewScreen("privacy")).toBe("privacy");
    expect(normalizePreviewScreen("settings")).toBe("settings");
    expect(normalizePreviewScreen("source-picker")).toBe("source-picker");
    expect(normalizePreviewScreen("translation")).toBe("translation");
    expect(normalizePreviewScreen("translation-muted")).toBe("translation-muted");
    expect(normalizePreviewScreen(["welcome"])).toBe("welcome");
    expect(normalizePreviewScreen("unknown")).toBe("welcome");
    expect(normalizePreviewScreen(undefined)).toBe("welcome");
  });
});
