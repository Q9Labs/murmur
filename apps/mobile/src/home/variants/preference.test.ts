import { afterEach, describe, expect, it, vi } from "vitest";

const { platform, secureStore } = vi.hoisted(() => ({
  platform: { OS: "ios" },
  secureStore: { deleteItemAsync: vi.fn(), getItemAsync: vi.fn(), setItemAsync: vi.fn() },
}));

vi.mock("expo-secure-store", () => secureStore);
vi.mock("react-native", () => ({ Platform: platform }));

import { deleteStoredUiVariant, getStoredUiVariant, setStoredUiVariant } from "./preference";

type TestWebStorage = {
  getItem(key: string): string | null;
  removeItem(key: string): void;
  setItem(key: string, value: string): void;
};

afterEach(() => {
  vi.clearAllMocks();
  platform.OS = "ios";
  Reflect.deleteProperty(globalThis, "localStorage");
});

describe("ui variant preference", () => {
  it("returns a stored native variant", async () => {
    secureStore.getItemAsync.mockResolvedValueOnce("bloom");

    await expect(getStoredUiVariant()).resolves.toBe("bloom");
  });

  it("ignores values that are not a known variant", async () => {
    secureStore.getItemAsync.mockResolvedValueOnce("sparkle");

    await expect(getStoredUiVariant()).resolves.toBeNull();
  });

  it("persists the selection natively", async () => {
    await setStoredUiVariant("bloom");

    expect(secureStore.setItemAsync).toHaveBeenCalledWith("murmur_ui_variant_v1", "bloom");
  });

  it("removes the native selection with local data", async () => {
    await deleteStoredUiVariant();

    expect(secureStore.deleteItemAsync).toHaveBeenCalledWith("murmur_ui_variant_v1");
  });

  it("uses web storage on web", async () => {
    platform.OS = "web";
    const store = new Map<string, string>();
    const webStorage: TestWebStorage = {
      getItem: (key) => store.get(key) ?? null,
      removeItem: (key) => void store.delete(key),
      setItem: (key, value) => void store.set(key, value),
    };
    Object.assign(globalThis, { localStorage: webStorage });

    await setStoredUiVariant("bloom");
    await expect(getStoredUiVariant()).resolves.toBe("bloom");
    expect(secureStore.setItemAsync).not.toHaveBeenCalled();

    await deleteStoredUiVariant();
    await expect(getStoredUiVariant()).resolves.toBeNull();
  });
});
