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
    expect(normalizePreviewScreen("translation")).toBe("translation");
    expect(normalizePreviewScreen(["welcome"])).toBe("welcome");
    expect(normalizePreviewScreen("unknown")).toBe("welcome");
    expect(normalizePreviewScreen(undefined)).toBe("welcome");
  });
});
