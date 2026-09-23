import { createTranslator, type UiText } from "../../i18n/runtime";
import type { UiLocale } from "../../i18n/types";

export function uiText(locale: UiLocale): UiText {
  return { locale, t: createTranslator(locale) };
}

export const en = uiText("en");
