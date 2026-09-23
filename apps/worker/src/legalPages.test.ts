import { describe, expect, it } from "vitest";

import { legalPages, renderLegalPage } from "./legalPages";

describe("legalPages", () => {
  it("defines the public legal and marketing routes", () => {
    expect(Object.keys(legalPages).sort()).toEqual([
      "/",
      "/arabic-to-english-live-captions",
      "/english-to-arabic-live-captions",
      "/live-translation-for-talks",
      "/live-translation-for-travel",
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
    expect(homepage.html).toContain("Verify an email before purchase");
  });

  it("uses route-accurate language pairs in the caption demos", () => {
    const englishToArabic = legalPages["/english-to-arabic-live-captions"].html;
    const arabicToEnglish = legalPages["/arabic-to-english-live-captions"].html;

    expect(englishToArabic).toContain('<span class="pill">English</span>');
    expect(englishToArabic).toContain('<span class="pill pill-alt">Arabic</span>');
    expect(englishToArabic).toContain('lang="ar" dir="rtl"');
    expect(arabicToEnglish).toContain('<span class="pill">Arabic</span>');
    expect(arabicToEnglish).toContain('<span class="pill pill-alt">English</span>');
    expect(arabicToEnglish).toContain('<strong lang="ar" dir="rtl">');
  });

  it("keeps the marketing sitemap date and focus treatment current", async () => {
    const sitemap = renderLegalPage("/sitemap.xml");
    const homepage = renderLegalPage("/");

    if (!sitemap || !homepage) {
      throw new Error("Expected public page responses");
    }

    expect(await sitemap.text()).toContain("<lastmod>2026-09-21</lastmod>");
    const homepageHtml = await homepage.text();
    expect(homepageHtml).toContain("box-shadow: 0 0 0 6px var(--ink)");
    expect(homepageHtml).toContain("header { align-items: flex-start; flex-direction: column; }");
    expect(homepageHtml).toContain("main { overflow-x: clip; padding-bottom: 96px; }");
  });

  it("keeps required support contact copy available", () => {
    expect(legalPages["/support"].html).toContain("q9labs.ai@gmail.com");
    expect(legalPages["/privacy"].html).toContain("Murmur Privacy Policy");
    expect(legalPages["/terms"].html).toContain("Murmur Terms of Use");
  });

  it("describes the AI processor by category on public pages", () => {
    const html = Object.values(legalPages).map((page) => page.html).join("\n");

    expect(html).toContain("third-party AI service provider");
    expect(html).not.toContain("OpenAI Realtime");
  });
});
