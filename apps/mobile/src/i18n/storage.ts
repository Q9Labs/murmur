import { deleteLocalValue, getLocalValue, setLocalValue } from "../lib/localStorage";
import { isUiLocalePreference, type UiLocalePreference } from "./types";

const uiLocaleStorageKey = "murmur_ui_locale_v1";

// Read failures propagate so the provider can report them before falling back.
export async function getStoredUiLocalePreference(): Promise<UiLocalePreference> {
  const value = await getLocalValue(uiLocaleStorageKey);
  return isUiLocalePreference(value) ? value : "system";
}

export async function setStoredUiLocalePreference(preference: UiLocalePreference): Promise<void> {
  if (!isUiLocalePreference(preference)) {
    throw new RangeError(`Unsupported UI locale: ${String(preference)}`);
  }
  await setLocalValue(uiLocaleStorageKey, preference);
}

export async function deleteStoredUiLocalePreference(): Promise<void> {
  await deleteLocalValue(uiLocaleStorageKey);
}
