export type UiLocale = "en" | "ar";
export type UiDirection = "ltr" | "rtl";

export function isUiLocale(value: unknown): value is UiLocale {
  return value === "en" || value === "ar";
}

export function directionForLocale(locale: UiLocale): UiDirection {
  if (!isUiLocale(locale)) {
    throw new RangeError(`Unsupported UI locale: ${String(locale)}`);
  }
  return locale === "ar" ? "rtl" : "ltr";
}
