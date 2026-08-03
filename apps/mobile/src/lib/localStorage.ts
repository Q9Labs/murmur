import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

type WebStorage = {
  getItem(storageId: string): string | null;
  removeItem(storageId: string): void;
  setItem(storageId: string, value: string): void;
};

export async function getLocalValue(storageId: string): Promise<string | null> {
  if (Platform.OS === "web") {
    return getWebStorage()?.getItem(storageId) ?? null;
  }
  return SecureStore.getItemAsync(storageId);
}

export async function setLocalValue(storageId: string, value: string): Promise<void> {
  if (Platform.OS === "web") {
    getWebStorage()?.setItem(storageId, value);
    return;
  }
  await SecureStore.setItemAsync(storageId, value);
}

export async function deleteLocalValue(storageId: string): Promise<void> {
  if (Platform.OS === "web") {
    getWebStorage()?.removeItem(storageId);
    return;
  }
  await SecureStore.deleteItemAsync(storageId);
}

function getWebStorage(): WebStorage | undefined {
  return (globalThis as typeof globalThis & { localStorage?: WebStorage }).localStorage;
}
