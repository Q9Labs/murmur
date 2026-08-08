import {
  deleteLocalValue,
  getLocalValue,
  setLocalValue,
} from "./localStorage";

const installIdKey = "murmur_install_id";
const legacyPrivacyAcknowledgementKey = "murmur_privacy_acknowledged_v1";
const privacyAcknowledgementKey = "murmur_third_party_ai_consent_v2";

export async function getOrCreateInstallId(): Promise<string> {
  const existing = await getLocalValue(installIdKey);
  if (existing) {
    return existing;
  }

  const installId = createInstallId();
  await setLocalValue(installIdKey, installId);
  return installId;
}

export async function resetInstallId(): Promise<string> {
  const installId = createInstallId();
  await setLocalValue(installIdKey, installId);
  return installId;
}

export async function hasAcknowledgedPrivacyDisclosure(): Promise<boolean> {
  return (await getLocalValue(privacyAcknowledgementKey)) === "true";
}

export async function acknowledgePrivacyDisclosure(): Promise<void> {
  await setLocalValue(privacyAcknowledgementKey, "true");
}

export async function deleteLocalMurmurData(): Promise<void> {
  await deleteLocalValue(installIdKey);
  await deleteLocalValue(legacyPrivacyAcknowledgementKey);
  await deleteLocalValue(privacyAcknowledgementKey);
}

function createInstallId(): string {
  return `install_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 14)}`;
}
