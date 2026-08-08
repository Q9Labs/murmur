import { deleteLocalValue, getLocalValue, setLocalValue } from "../../lib/localStorage";
import { isUiVariant } from "./logic";
import type { UiVariant } from "./types";

const uiVariantStorageId = "murmur_ui_variant_v1";

export async function getStoredUiVariant(): Promise<UiVariant | null> {
  const stored = await getLocalValue(uiVariantStorageId);
  return isUiVariant(stored) ? stored : null;
}

export async function setStoredUiVariant(variant: UiVariant): Promise<void> {
  await setLocalValue(uiVariantStorageId, variant);
}

export async function deleteStoredUiVariant(): Promise<void> {
  await deleteLocalValue(uiVariantStorageId);
}
