import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const installIdKey = "murmur_install_id";
const legacyPrivacyAcknowledgementKey = "murmur_privacy_acknowledged_v1";
const privacyAcknowledgementKey = "murmur_third_party_ai_consent_v2";

type WebStorage = {
  getItem(key: string): string | null;
  removeItem(key: string): void;
  setItem(key: string, value: string): void;
};

export async function getOrCreateInstallId(): Promise<string> {
  const existing = await getStoredValue(installIdKey);
  if (existing) {
    return existing;
  }

  const installId = createInstallId();
  await setStoredValue(installIdKey, installId);
  return installId;
}

export async function resetInstallId(): Promise<string> {
  const installId = createInstallId();
  await setStoredValue(installIdKey, installId);
  return installId;
}

export async function hasAcknowledgedPrivacyDisclosure(): Promise<boolean> {
  return (await getStoredValue(privacyAcknowledgementKey)) === "true";
}

export async function acknowledgePrivacyDisclosure(): Promise<void> {
  await setStoredValue(privacyAcknowledgementKey, "true");
}

export async function deleteLocalMurmurData(): Promise<void> {
  await deleteStoredValue(installIdKey);
  await deleteStoredValue(legacyPrivacyAcknowledgementKey);
  await deleteStoredValue(privacyAcknowledgementKey);
}

function createInstallId(): string {
  return `install_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 14)}`;
}

async function getStoredValue(key: string): Promise<string | null> {
  if (Platform.OS === "web") {
    return getWebStorage()?.getItem(key) ?? null;
  }
  return SecureStore.getItemAsync(key);
}

async function setStoredValue(key: string, value: string): Promise<void> {
  if (Platform.OS === "web") {
    getWebStorage()?.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function deleteStoredValue(key: string): Promise<void> {
  if (Platform.OS === "web") {
    getWebStorage()?.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

function getWebStorage(): WebStorage | undefined {
  return (globalThis as typeof globalThis & { localStorage?: WebStorage }).localStorage;
}
