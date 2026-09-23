import { createContext, useContext } from "react";

import { textAlignFollowsLayout } from "../lib/config";
import { catalogMessage, catalogs, interpolate, isMessageKey } from "./catalogs";
import type { Catalog, MessageKey } from "./catalogs/en";
import {
  directionForLocale,
  intlLocaleTag,
  isUiLocale,
  type UiDirection,
  type UiLocale,
  type UiLocalePreference,
} from "./types";

export type InterpolationValues = Readonly<Partial<Record<string, string | number>>>;
export type Translate = (key: MessageKey, values?: InterpolationValues) => string;

export type UiNumberFormatOptions = Intl.NumberFormatOptions & {
  grouping?: boolean;
};

export type UiLocaleContextValue = {
  locale: UiLocale;
  preference: UiLocalePreference;
  direction: UiDirection;
  ready: boolean;
  t: Translate;
  translate: Translate;
  setPreference: (preference: UiLocalePreference) => Promise<void>;
  deleteLocale: () => Promise<void>;
};

// The slice of the UI locale that plain copy functions need.
export type UiText = Pick<UiLocaleContextValue, "locale" | "t">;

const fallbackTranslator = createTranslator("en");
const fallbackContext: UiLocaleContextValue = {
  locale: "en",
  preference: "system",
  direction: "ltr",
  ready: true,
  t: fallbackTranslator,
  translate: fallbackTranslator,
  setPreference: async () => undefined,
  deleteLocale: async () => undefined,
};

export const UiLocaleContext = createContext<UiLocaleContextValue>(fallbackContext);

export function createTranslator(locale: UiLocale): Translate {
  if (!isUiLocale(locale)) {
    throw new RangeError(`Unsupported UI locale: ${String(locale)}`);
  }
  return translatorForCatalog(catalogs[locale]);
}

export function translatorForCatalog(catalog: Catalog): Translate {
  return (key, values) => {
    if (!isMessageKey(key)) {
      throw new Error(`Unknown i18n message key: ${String(key)}`);
    }
    return interpolate(catalogMessage(catalog, key), key, values);
  };
}

export function useUiLocale(): UiLocaleContextValue {
  return useContext(UiLocaleContext);
}

function resolveDirection(value: UiLocale | UiDirection): UiDirection {
  if (isUiLocale(value)) {
    return directionForLocale(value);
  }
  if (value === "ltr" || value === "rtl") {
    return value;
  }
  throw new RangeError(`Unsupported UI direction value: ${String(value)}`);
}

export function uiContentDirectionStyle(value: UiLocale | UiDirection): { direction: UiDirection } {
  return { direction: resolveDirection(value) };
}

// Aligns text to the start edge of its own reading direction. Pass the surrounding layout
// direction when it can differ from the text, such as an Arabic caption in the English UI.
export function uiTextDirectionStyle(
  value: UiLocale | UiDirection,
  layout: UiLocale | UiDirection = value,
): {
  textAlign: "left" | "right";
  writingDirection: UiDirection;
} {
  const direction = resolveDirection(value);
  const swapped = textAlignFollowsLayout() && resolveDirection(layout) === "rtl";
  return {
    textAlign: (direction === "rtl") !== swapped ? "right" : "left",
    writingDirection: direction,
  };
}

export function formatUiNumber(
  value: number,
  locale: UiLocale = "en",
  options: UiNumberFormatOptions = {},
): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TypeError("formatUiNumber expects a finite number");
  }
  if (!isUiLocale(locale)) {
    throw new RangeError(`Unsupported UI locale: ${String(locale)}`);
  }
  const { grouping, ...intlOptions } = options;
  return new Intl.NumberFormat(intlLocaleTag(locale), {
    ...intlOptions,
    useGrouping: options.useGrouping ?? grouping ?? false,
  }).format(value);
}

export function formatUiDate(
  value: Date | number,
  locale: UiLocale,
  options: Intl.DateTimeFormatOptions,
): string {
  return new Intl.DateTimeFormat(intlLocaleTag(locale), options).format(value);
}

// Translation languages keep their English name in the English UI and their own
// name (endonym) everywhere else, which every listener can read.
export function languageLabel(
  language: { display_name: string; native_name: string },
  locale: UiLocale,
): string {
  return locale === "en" ? language.display_name : language.native_name;
}

// Icons that point along the reading direction (chevrons, back arrows) flip in RTL.
export function uiMirrorStyle(direction: UiDirection): { transform: [{ scaleX: -1 }] } | undefined {
  return direction === "rtl" ? { transform: [{ scaleX: -1 }] } : undefined;
}
