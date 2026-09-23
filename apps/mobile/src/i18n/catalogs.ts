import { arCatalog } from "./catalogs/ar";
import { deCatalog } from "./catalogs/de";
import { enCatalog, type Catalog, type MessageKey } from "./catalogs/en";
import { esCatalog } from "./catalogs/es";
import { frCatalog } from "./catalogs/fr";
import { hiCatalog } from "./catalogs/hi";
import { idCatalog } from "./catalogs/id";
import { jaCatalog } from "./catalogs/ja";
import { ptBRCatalog } from "./catalogs/pt-BR";
import { trCatalog } from "./catalogs/tr";
import { urCatalog } from "./catalogs/ur";
import type { UiLocale } from "./types";

export const catalogs: { readonly [Locale in UiLocale]: Catalog } = {
  ar: arCatalog,
  de: deCatalog,
  en: enCatalog,
  es: esCatalog,
  fr: frCatalog,
  hi: hiCatalog,
  id: idCatalog,
  ja: jaCatalog,
  "pt-BR": ptBRCatalog,
  tr: trCatalog,
  ur: urCatalog,
};

const placeholderPattern = /\{([A-Za-z][A-Za-z0-9_]*)\}/g;

export function isMessageKey(value: string): value is MessageKey {
  return Object.prototype.hasOwnProperty.call(enCatalog, value);
}

// A locale missing a key falls back to English so a late string never blanks the UI.
export function catalogMessage(catalog: Catalog, key: MessageKey): string {
  return catalog[key] ?? enCatalog[key];
}

export function placeholderNames(value: string): string[] {
  return [...value.matchAll(placeholderPattern)].map((match) => match[1]);
}

export function interpolate(
  message: string,
  key: string,
  values: Readonly<Partial<Record<string, string | number>>> | undefined,
): string {
  return message.replace(placeholderPattern, (_placeholder, name: string) => {
    const value = values?.[name];
    if (value === undefined) {
      throw new Error(`Missing interpolation value "${name}" for i18n message "${key}"`);
    }
    return String(value);
  });
}
