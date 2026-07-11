import { describe, expect, it } from "vitest";

import { legalPages } from "./legalPages";

describe("legalPages", () => {
  it("defines the public legal and marketing routes", () => {
    expect(Object.keys(legalPages).sort()).toEqual([
      "/",
      "/privacy",
      "/support",
      "/terms",
    ]);
  });

  it("keeps store and privacy disclosures on the marketing page", () => {
    const homepage = legalPages["/"];

    expect(homepage.isMarketing).toBe(true);
    expect(homepage.html).toContain("App Store");
    expect(homepage.html).toContain("Google Play");
    expect(homepage.html).toContain("No audio or transcript history saved by default.");
  });

  it("keeps required support contact copy available", () => {
    expect(legalPages["/support"].html).toContain("q9labs.ai@gmail.com");
    expect(legalPages["/privacy"].html).toContain("Murmur Privacy Policy");
    expect(legalPages["/terms"].html).toContain("Murmur Terms of Use");
  });
});
