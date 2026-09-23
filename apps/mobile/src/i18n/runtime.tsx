import { createContext, useContext } from "react";

import {
  arCatalog,
  assertCatalogParity,
  enCatalog,
  placeholderNames,
  type MessageKey,
} from "./catalogs";
import { directionForLocale, isUiLocale, type UiDirection, type UiLocale } from "./types";

type InterpolationValue = string | number;
export type Translate = <K extends MessageKey>(
  key: K,
  values?: Record<string, InterpolationValue>,
) => string;

export type UiNumberFormatOptions = Intl.NumberFormatOptions & {
  grouping?: boolean;
};

export type UiLocaleContextValue = {
  locale: UiLocale;
  direction: UiDirection;
  ready: boolean;
  t: Translate;
  translate: Translate;
  setLocale: (locale: UiLocale) => Promise<void>;
  deleteLocale: () => Promise<void>;
};

assertCatalogParity();

const fallbackTranslator = createTranslator("en");
const fallbackContext: UiLocaleContextValue = {
  locale: "en",
  direction: "ltr",
  ready: true,
  t: fallbackTranslator,
  translate: fallbackTranslator,
  setLocale: async () => undefined,
  deleteLocale: async () => undefined,
};

export const UiLocaleContext = createContext<UiLocaleContextValue>(fallbackContext);

export function createTranslator(locale: UiLocale): Translate {
  if (!isUiLocale(locale)) {
    throw new RangeError(`Unsupported UI locale: ${String(locale)}`);
  }
  const catalog = locale === "ar" ? arCatalog : enCatalog;
  return ((key: MessageKey, values?: Record<string, InterpolationValue>) => {
    if (!Object.prototype.hasOwnProperty.call(catalog, key)) {
      throw new Error(`Unknown i18n message key: ${String(key)}`);
    }
    const message = catalog[key];
    const names = placeholderNames(message);
    if (names.length === 0) {
      return message;
    }
    return message.replace(/\{([A-Za-z][A-Za-z0-9_]*)\}/g, (placeholder, name: string) => {
      if (!values || !Object.prototype.hasOwnProperty.call(values, name) || values[name] === undefined) {
        throw new Error(`Missing interpolation value "${name}" for i18n message "${key}"`);
      }
      return String(values[name]);
    });
  }) as Translate;
}

export function useUiLocale(): UiLocaleContextValue {
  return useContext(UiLocaleContext);
}

function resolveDirection(value: UiLocale | UiDirection): UiDirection {
  if (value === "en" || value === "ar") {
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
  return new Intl.NumberFormat(locale === "ar" ? "ar-u-nu-arab" : "en", {
    ...intlOptions,
    useGrouping: options.useGrouping ?? grouping ?? false,
  }).format(value);
}
