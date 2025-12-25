import { type Language, SUPPORTED_LANGUAGES } from "@/types";

describe("Types and Constants", () => {
	describe("SUPPORTED_LANGUAGES", () => {
		it("contains exactly 12 languages", () => {
			expect(SUPPORTED_LANGUAGES).toHaveLength(12);
		});

		it("has all required properties for each language", () => {
			SUPPORTED_LANGUAGES.forEach((language) => {
				expect(language).toHaveProperty("code");
				expect(language).toHaveProperty("name");
				expect(language).toHaveProperty("nativeName");
				expect(language).toHaveProperty("flag");

				expect(typeof language.code).toBe("string");
				expect(typeof language.name).toBe("string");
				expect(typeof language.nativeName).toBe("string");
				expect(typeof language.flag).toBe("string");
			});
		});

		it("has unique language codes", () => {
			const codes = SUPPORTED_LANGUAGES.map((lang) => lang.code);
			const uniqueCodes = new Set(codes);
			expect(uniqueCodes.size).toBe(SUPPORTED_LANGUAGES.length);
		});

		it("includes expected languages", () => {
			const languageNames = SUPPORTED_LANGUAGES.map((lang) => lang.name);

			expect(languageNames).toContain("Spanish");
			expect(languageNames).toContain("French");
			expect(languageNames).toContain("German");
			expect(languageNames).toContain("Italian");
			expect(languageNames).toContain("Portuguese");
			expect(languageNames).toContain("Japanese");
			expect(languageNames).toContain("Chinese");
			expect(languageNames).toContain("Korean");
			expect(languageNames).toContain("Arabic");
			expect(languageNames).toContain("Russian");
			expect(languageNames).toContain("Hindi");
			expect(languageNames).toContain("Dutch");
		});

		it("has correct language codes", () => {
			const languageCodes = SUPPORTED_LANGUAGES.map((lang) => lang.code);

			expect(languageCodes).toContain("es"); // Spanish
			expect(languageCodes).toContain("fr"); // French
			expect(languageCodes).toContain("de"); // German
			expect(languageCodes).toContain("ja"); // Japanese
			expect(languageCodes).toContain("zh"); // Chinese
		});

		it("has native names for all languages", () => {
			const spanish = SUPPORTED_LANGUAGES.find((lang) => lang.code === "es");
			expect(spanish?.nativeName).toBe("Español");

			const french = SUPPORTED_LANGUAGES.find((lang) => lang.code === "fr");
			expect(french?.nativeName).toBe("Français");

			const japanese = SUPPORTED_LANGUAGES.find((lang) => lang.code === "ja");
			expect(japanese?.nativeName).toBe("日本語");
		});

		it("has flag emoji for all languages", () => {
			SUPPORTED_LANGUAGES.forEach((language) => {
				expect(language.flag.length).toBeGreaterThan(0);
				// Emojis are typically 2 or more characters in length
				expect(language.flag.length).toBeGreaterThanOrEqual(2);
			});
		});
	});

	describe("Language Interface", () => {
		it("matches the expected structure", () => {
			const testLanguage: Language = {
				code: "en",
				name: "English",
				nativeName: "English",
				flag: "🇺🇸",
			};

			expect(testLanguage.code).toBe("en");
			expect(testLanguage.name).toBe("English");
			expect(testLanguage.nativeName).toBe("English");
			expect(testLanguage.flag).toBe("🇺🇸");
		});
	});
});
