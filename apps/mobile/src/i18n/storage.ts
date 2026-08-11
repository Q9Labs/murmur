import { deleteLocalValue, getLocalValue, setLocalValue } from "../lib/localStorage";
import { isUiLocale, type UiLocale } from "./types";

export const UI_LOCALE_STORAGE_KEY = "murmur_ui_locale_v1";

export async function getStoredUiLocale(): Promise<UiLocale> {
  try {
    const value = await getLocalValue(UI_LOCALE_STORAGE_KEY);
    return isUiLocale(value) ? value : "en";
  } catch {
    return "en";
  }
}

export async function setStoredUiLocale(locale: UiLocale): Promise<void> {
  if (!isUiLocale(locale)) {
    throw new RangeError(`Unsupported UI locale: ${String(locale)}`);
  }
  await setLocalValue(UI_LOCALE_STORAGE_KEY, locale);
}

export async function deleteStoredUiLocale(): Promise<void> {
  await deleteLocalValue(UI_LOCALE_STORAGE_KEY);
}
