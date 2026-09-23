import { describe, expect, it } from "vitest";

import { arCatalog, assertCatalogParity, enCatalog, placeholderNames } from "./catalogs";

describe("UI catalogs", () => {
  it("has exact English and Arabic key and placeholder parity", () => {
    expect(Object.keys(arCatalog).sort()).toEqual(Object.keys(enCatalog).sort());
    expect(() => assertCatalogParity()).not.toThrow();
    for (const key of Object.keys(enCatalog) as Array<keyof typeof enCatalog>) {
      expect(placeholderNames(arCatalog[key]).sort()).toEqual(placeholderNames(enCatalog[key]).sort());
    }
  });
});
