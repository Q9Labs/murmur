import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

import { isUiVariant } from "./logic";
import type { UiVariant } from "./types";

const uiVariantStorageId = "murmur_ui_variant_v1";

type WebStorage = {
  getItem(key: string): string | null;
  removeItem(key: string): void;
  setItem(key: string, value: string): void;
};

export async function getStoredUiVariant(): Promise<UiVariant | null> {
  const stored = await getStoredValue(uiVariantStorageId);
  return isUiVariant(stored) ? stored : null;
}

export async function setStoredUiVariant(variant: UiVariant): Promise<void> {
  if (Platform.OS === "web") {
    getWebStorage()?.setItem(uiVariantStorageId, variant);
    return;
  }
  await SecureStore.setItemAsync(uiVariantStorageId, variant);
}

export async function deleteStoredUiVariant(): Promise<void> {
  if (Platform.OS === "web") {
    getWebStorage()?.removeItem(uiVariantStorageId);
    return;
  }
  await SecureStore.deleteItemAsync(uiVariantStorageId);
}

async function getStoredValue(key: string): Promise<string | null> {
  if (Platform.OS === "web") {
    return getWebStorage()?.getItem(key) ?? null;
  }
  return SecureStore.getItemAsync(key);
}

function getWebStorage(): WebStorage | undefined {
  return (globalThis as typeof globalThis & { localStorage?: WebStorage }).localStorage;
}
