import { afterEach, describe, expect, it, vi } from "vitest";

const { platform, secureStore } = vi.hoisted(() => ({
  platform: { OS: "ios" },
  secureStore: { deleteItemAsync: vi.fn(), getItemAsync: vi.fn(), setItemAsync: vi.fn() },
}));

vi.mock("expo-secure-store", () => secureStore);
vi.mock("react-native", () => ({ Platform: platform }));

import { deleteLocalValue, getLocalValue, setLocalValue } from "./localStorage";

afterEach(() => {
  vi.clearAllMocks();
  platform.OS = "ios";
  Reflect.deleteProperty(globalThis, "localStorage");
});

describe("local storage", () => {
  it("uses secure storage on native platforms", async () => {
    secureStore.getItemAsync.mockResolvedValueOnce("stored");

    await expect(getLocalValue("key")).resolves.toBe("stored");
    await setLocalValue("key", "value");
    await deleteLocalValue("key");

    expect(secureStore.setItemAsync).toHaveBeenCalledWith("key", "value");
    expect(secureStore.deleteItemAsync).toHaveBeenCalledWith("key");
  });

  it("uses browser storage on web", async () => {
    platform.OS = "web";
    const values = new Map<string, string>();
    Object.assign(globalThis, {
      localStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        removeItem: (key: string) => void values.delete(key),
        setItem: (key: string, value: string) => void values.set(key, value),
      },
    });

    await setLocalValue("key", "value");
    await expect(getLocalValue("key")).resolves.toBe("value");
    await deleteLocalValue("key");
    await expect(getLocalValue("key")).resolves.toBeNull();
    expect(secureStore.setItemAsync).not.toHaveBeenCalled();
  });

  it("rejects browser writes and deletes when local storage is unavailable", async () => {
    platform.OS = "web";

    await expect(setLocalValue("key", "value")).rejects.toThrow(
      "Browser local storage is unavailable.",
    );
    await expect(deleteLocalValue("key")).rejects.toThrow(
      "Browser local storage is unavailable.",
    );
    await expect(getLocalValue("key")).resolves.toBeNull();
  });
});
