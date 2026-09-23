import { describe, expect, it } from "vitest";

import { catalogMessage, catalogs, interpolate, isMessageKey, placeholderNames } from "./catalogs";
import { arCatalog } from "./catalogs/ar";
import { deCatalog } from "./catalogs/de";
import { enCatalog, type MessageKey } from "./catalogs/en";
import { esCatalog } from "./catalogs/es";
import { frCatalog } from "./catalogs/fr";
import { hiCatalog } from "./catalogs/hi";
import { idCatalog } from "./catalogs/id";
import { jaCatalog } from "./catalogs/ja";
import { ptBRCatalog } from "./catalogs/pt-BR";
import { trCatalog } from "./catalogs/tr";
import { urCatalog } from "./catalogs/ur";
import { uiLocales } from "./types";

const englishKeys = Object.keys(enCatalog).filter(isMessageKey).sort();
const translated = { ar: arCatalog, de: deCatalog, es: esCatalog, fr: frCatalog, hi: hiCatalog, id: idCatalog, ja: jaCatalog, "pt-BR": ptBRCatalog, tr: trCatalog, ur: urCatalog };
const productNames = ["Murmur", "Pro Max", "Trip Pass", "Event Pass"];
const vendorPattern = /openai|chatgpt|gpt-|gemini|anthropic|claude|soniox|google ai/i;

describe("UI catalogs", () => {
  it("registers a catalog for every shipped locale", () => {
    expect(Object.keys(catalogs).sort()).toEqual([...uiLocales].sort());
  });

  it.each(Object.entries(translated))("ships a complete %s catalog with matching placeholders", (_locale, catalog) => {
    expect(Object.keys(catalog).sort()).toEqual(englishKeys);
    for (const key of englishKeys) {
      const message = catalogMessage(catalog, key);
      expect(message.trim(), key).not.toBe("");
      expect(placeholderNames(message).sort(), key).toEqual(placeholderNames(enCatalog[key]).sort());
    }
  });

  it.each(Object.entries(translated))("keeps product names untranslated and names no AI vendor in %s", (_locale, catalog) => {
    for (const key of englishKeys) {
      const english: string = enCatalog[key];
      const message = catalogMessage(catalog, key);
      expect(vendorPattern.test(message), key).toBe(false);
      for (const name of productNames.filter((product) => english.includes(product))) {
        expect(message, key).toContain(name);
      }
    }
  });

  it("interpolates named values and rejects missing ones", () => {
    const key: MessageKey = "home.reportReceived";
    expect(interpolate(enCatalog[key], key, { receiptId: "x" })).toBe("Report received: x");
    expect(() => interpolate(enCatalog[key], key, {})).toThrow("Missing interpolation value");
    expect(isMessageKey("home.stop")).toBe(true);
    expect(isMessageKey("home.nope")).toBe(false);
  });
});
