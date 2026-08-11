import { deleteLocalValue, getLocalValue, setLocalValue } from "../lib/localStorage";
import { isUiLocale, type UiLocale } from "./types";

const uiLocaleStorageKey = "murmur_ui_locale_v1";

export async function getStoredUiLocale(): Promise<UiLocale> {
  try {
    const value = await getLocalValue(uiLocaleStorageKey);
    return isUiLocale(value) ? value : "en";
  } catch {
    return "en";
  }
}

export async function setStoredUiLocale(locale: UiLocale): Promise<void> {
  if (!isUiLocale(locale)) {
    throw new RangeError(`Unsupported UI locale: ${String(locale)}`);
  }
  await setLocalValue(uiLocaleStorageKey, locale);
}

export async function deleteStoredUiLocale(): Promise<void> {
  await deleteLocalValue(uiLocaleStorageKey);
}
