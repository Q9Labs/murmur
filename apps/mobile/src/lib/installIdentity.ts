import {
  deleteLocalValue,
  getLocalValue,
  setLocalValue,
} from "./localStorage";

const installIdKey = "murmur_install_id";
const freeAllowanceIdKey = "murmur_free_allowance_id";
const legacyPrivacyAcknowledgementKey = "murmur_privacy_acknowledged_v1";
const privacyAcknowledgementKey = "murmur_third_party_ai_consent_v2";
let installIdCreation: Promise<string> | null = null;
let freeAllowanceIdCreation: Promise<string> | null = null;

export async function getOrCreateInstallId(): Promise<string> {
  if (!installIdCreation) {
    installIdCreation = readOrCreateInstallId();
  }
  const pendingCreation = installIdCreation;
  try {
    return await pendingCreation;
  } finally {
    if (installIdCreation === pendingCreation) {
      installIdCreation = null;
    }
  }
}

export async function getOrCreateFreeAllowanceId(): Promise<string> {
  if (!freeAllowanceIdCreation) {
    freeAllowanceIdCreation = readOrCreateIdentity(freeAllowanceIdKey, "free");
  }
  const pendingCreation = freeAllowanceIdCreation;
  try {
    return await pendingCreation;
  } finally {
    if (freeAllowanceIdCreation === pendingCreation) {
      freeAllowanceIdCreation = null;
    }
  }
}

async function readOrCreateInstallId(): Promise<string> {
  return readOrCreateIdentity(installIdKey, "install");
}

async function readOrCreateIdentity(
  key: string,
  prefix: "free" | "install",
): Promise<string> {
  const existing = await getLocalValue(key);
  if (existing) {
    return existing;
  }

  const identity = createIdentity(prefix);
  await setLocalValue(key, identity);
  return identity;
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
  await deleteLocalValue(freeAllowanceIdKey);
  await deleteLocalValue(legacyPrivacyAcknowledgementKey);
  await deleteLocalValue(privacyAcknowledgementKey);
}

function createInstallId(): string {
  return createIdentity("install");
}

function createIdentity(prefix: "free" | "install"): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 14)}`;
}
