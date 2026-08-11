import { afterEach, describe, expect, it, vi } from "vitest";

const { platform, secureStore } = vi.hoisted(() => ({
  platform: { OS: "ios" },
  secureStore: { deleteItemAsync: vi.fn(), getItemAsync: vi.fn(), setItemAsync: vi.fn() },
}));

vi.mock("expo-secure-store", () => secureStore);
vi.mock("react-native", () => ({ Platform: platform }));

import {
  deleteStoredUiLocale,
  getStoredUiLocale,
  setStoredUiLocale,
} from "./storage";

afterEach(() => {
  vi.clearAllMocks();
  platform.OS = "ios";
});

describe("stored UI locale", () => {
  it("restores missing or invalid values as English without rewriting", async () => {
    secureStore.getItemAsync.mockResolvedValueOnce(null).mockResolvedValueOnce("ar-SA");

    await expect(getStoredUiLocale()).resolves.toBe("en");
    await expect(getStoredUiLocale()).resolves.toBe("en");
    expect(secureStore.setItemAsync).not.toHaveBeenCalled();
  });

  it("does not hide storage failures and rejects unsupported locales", async () => {
    secureStore.getItemAsync.mockRejectedValueOnce(new Error("read failed"));
    secureStore.setItemAsync.mockRejectedValueOnce(new Error("write failed"));
    secureStore.deleteItemAsync.mockRejectedValueOnce(new Error("delete failed"));

    await expect(getStoredUiLocale()).resolves.toBe("en");
    await expect(setStoredUiLocale("ar")).rejects.toThrow("write failed");
    await expect(deleteStoredUiLocale()).rejects.toThrow("delete failed");
    await expect(setStoredUiLocale("ar-SA" as never)).rejects.toThrow("Unsupported UI locale");
  });
});
