import { afterEach, describe, expect, it, vi } from "vitest";

const secureStore = vi.hoisted(() => ({
  deleteItemAsync: vi.fn(),
  getItemAsync: vi.fn(),
  setItemAsync: vi.fn(),
}));

const platform = vi.hoisted(() => ({ OS: "ios" }));

vi.mock("expo-secure-store", () => secureStore);
vi.mock("react-native", () => ({ Platform: platform }));

import {
  acknowledgePrivacyDisclosure,
  deleteLocalMurmurData,
  getOrCreateInstallId,
  hasAcknowledgedPrivacyDisclosure,
  resetInstallId,
} from "./installIdentity";

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

describe("install identity storage", () => {
  it("returns a stored native install id without replacing it", async () => {
    secureStore.getItemAsync.mockResolvedValueOnce("install_existing");

    await expect(getOrCreateInstallId()).resolves.toBe("install_existing");
    expect(secureStore.setItemAsync).not.toHaveBeenCalled();
  });

  it("creates and stores a native install id when none exists", async () => {
    secureStore.getItemAsync.mockResolvedValueOnce(null);

    const installId = await getOrCreateInstallId();

    expect(installId).toMatch(/^install_[a-z0-9]+_[a-z0-9]+$/);
    expect(secureStore.setItemAsync).toHaveBeenCalledWith("murmur_install_id", installId);
  });

  it("uses web localStorage for web installs and privacy acknowledgements", async () => {
    platform.OS = "web";
    const storedValues = new Map<string, string>();
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
      getItem: vi.fn((key: string) => storedValues.get(key) ?? null),
      removeItem: vi.fn((key: string) => {
        storedValues.delete(key);
      }),
      setItem: vi.fn((key: string, value: string) => {
        storedValues.set(key, value);
      }),
      } satisfies TestWebStorage,
    });

    expect(await hasAcknowledgedPrivacyDisclosure()).toBe(false);
    await acknowledgePrivacyDisclosure();
    expect(await hasAcknowledgedPrivacyDisclosure()).toBe(true);

    const installId = await resetInstallId();
    expect(storedValues.get("murmur_install_id")).toBe(installId);

    await deleteLocalMurmurData();
    expect(storedValues.has("murmur_install_id")).toBe(false);
    expect(storedValues.has("murmur_third_party_ai_consent_v2")).toBe(false);
  });
});
