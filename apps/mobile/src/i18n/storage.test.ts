import { afterEach, describe, expect, it, vi } from "vitest";

const localValues = vi.hoisted(() => ({
  deleteLocalValue: vi.fn(),
  getLocalValue: vi.fn(),
  setLocalValue: vi.fn(),
}));

vi.mock("../lib/localStorage", () => localValues);

import {
  deleteStoredUiLocale,
  getStoredUiLocale,
  setStoredUiLocale,
} from "./storage";

afterEach(() => {
  vi.clearAllMocks();
});

describe("stored UI locale", () => {
  it("restores missing or invalid values as English without rewriting", async () => {
    localValues.getLocalValue.mockResolvedValueOnce(null).mockResolvedValueOnce("ar-SA");

    await expect(getStoredUiLocale()).resolves.toBe("en");
    await expect(getStoredUiLocale()).resolves.toBe("en");
    expect(localValues.setLocalValue).not.toHaveBeenCalled();
  });

  it("does not hide storage failures and rejects unsupported locales", async () => {
    localValues.getLocalValue.mockRejectedValueOnce(new Error("read failed"));
    localValues.setLocalValue.mockRejectedValueOnce(new Error("write failed"));
    localValues.deleteLocalValue.mockRejectedValueOnce(new Error("delete failed"));

    await expect(getStoredUiLocale()).resolves.toBe("en");
    await expect(setStoredUiLocale("ar")).rejects.toThrow("write failed");
    await expect(deleteStoredUiLocale()).rejects.toThrow("delete failed");
    await expect(setStoredUiLocale("ar-SA" as never)).rejects.toThrow("Unsupported UI locale");
  });
});
