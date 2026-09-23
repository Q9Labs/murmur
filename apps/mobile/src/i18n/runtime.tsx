import { createContext, useContext } from "react";

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

export function uiTextDirectionStyle(value: UiLocale | UiDirection): {
  textAlign: "left" | "right";
  writingDirection: UiDirection;
} {
  const direction = resolveDirection(value);
  return {
    textAlign: direction === "rtl" ? "right" : "left",
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

// Icons that point along the reading direction (chevrons, back arrows) flip in RTL.
export function uiMirrorStyle(direction: UiDirection): { transform: [{ scaleX: -1 }] } | undefined {
  return direction === "rtl" ? { transform: [{ scaleX: -1 }] } : undefined;
}
