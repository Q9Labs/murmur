import { afterEach, describe, expect, it, vi } from "vitest";

const localValues = vi.hoisted(() => ({
  deleteLocalValue: vi.fn(),
  getLocalValue: vi.fn(),
  setLocalValue: vi.fn(),
}));

vi.mock("../lib/localStorage", () => localValues);

import {
  deleteStoredUiLocalePreference,
  getStoredUiLocalePreference,
  setStoredUiLocalePreference,
} from "./storage";

afterEach(() => {
  vi.clearAllMocks();
});

describe("stored UI locale preference", () => {
  it("restores a saved locale and treats missing or invalid values as the system default", async () => {
    localValues.getLocalValue
      .mockResolvedValueOnce("hi")
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce("ar-SA");

    await expect(getStoredUiLocalePreference()).resolves.toBe("hi");
    await expect(getStoredUiLocalePreference()).resolves.toBe("system");
    await expect(getStoredUiLocalePreference()).resolves.toBe("system");
    expect(localValues.setLocalValue).not.toHaveBeenCalled();
  });

  it("stores the system default and explicit locales", async () => {
    await setStoredUiLocalePreference("system");
    await setStoredUiLocalePreference("pt-BR");
    expect(localValues.setLocalValue.mock.calls).toEqual([
      ["murmur_ui_locale_v1", "system"],
      ["murmur_ui_locale_v1", "pt-BR"],
    ]);
  });

  it("does not hide storage failures and rejects unsupported locales", async () => {
    localValues.getLocalValue.mockRejectedValueOnce(new Error("read failed"));
    localValues.setLocalValue.mockRejectedValueOnce(new Error("write failed"));
    localValues.deleteLocalValue.mockRejectedValueOnce(new Error("delete failed"));

    await expect(getStoredUiLocalePreference()).rejects.toThrow("read failed");
    await expect(setStoredUiLocalePreference("ar")).rejects.toThrow("write failed");
    await expect(deleteStoredUiLocalePreference()).rejects.toThrow("delete failed");
    await expect(setStoredUiLocalePreference("ar-SA" as never)).rejects.toThrow("Unsupported UI locale");
  });
});
