// cspell:ignore magick
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import {
  captureRelativePath,
  findPlaceholder,
  headlineFontFor,
  readPngSize,
  screenshotHeadlines,
  screenshotSets,
  storeLocales,
} from "./build-store-screenshots.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const mobileRoot = join(repoRoot, "apps", "mobile");
const hasImageMagick = spawnSync("magick", ["-version"], { stdio: "ignore" }).status === 0;
const english = storeLocales.find((locale) => locale.appLocale === "en");

test("Option B screenshot lists pair each published name with a native capture", () => {
  const [ios, android] = screenshotSets;

  assert.deepEqual(
    ios.screenshots.map(({ screen, target }) => [screen, target]),
    [
      ["translation", "01-live-translation.png"],
      ["picker", "02-choose-languages.png"],
      ["translation-only", "03-hear-translation.png"],
      ["translation-background", "04-background-listening.png"],
      ["plans-packs", "05-plans.png"],
      ["privacy", "06-privacy.png"],
      ["account-guest", "07-no-account.png"],
      ["app-language", "08-app-language.png"],
    ],
  );
  assert.deepEqual(
    android.screenshots.map(({ screen, target }) => [screen, target]),
    [
      ["translation", "01-live-translation.png"],
      ["picker", "02-choose-languages.png"],
      ["translation-phone-audio", "03-phone-audio.png"],
      ["translation-background", "04-background-listening.png"],
      ["plans-packs", "05-plans.png"],
      ["privacy", "06-privacy.png"],
      ["account-guest", "07-no-account.png"],
      ["app-language", "08-app-language.png"],
    ],
  );
  assert.equal(ios.width, 1320);
  assert.equal(ios.height, 2868);
  assert.equal(android.width, 1080);
  assert.equal(android.height, 1920);
});

test("English screenshots publish to en-US on both stores and mirror to en-GB Play", () => {
  const [ios, android] = screenshotSets;

  assert.deepEqual(ios.outputDirectories(english), ["fastlane/metadata/en-US/screenshots"]);
  assert.deepEqual(android.outputDirectories(english), [
    "fastlane/metadata/android/en-US/images/phoneScreenshots",
    "fastlane/metadata/android/en-GB/images/phoneScreenshots",
  ]);
});

test("every app language has a headline for every screenshot", () => {
  assert.equal(storeLocales.length, 11);
  for (const locale of storeLocales) {
    const headlines = screenshotHeadlines[locale.appLocale];
    for (const set of screenshotSets) {
      for (const screenshot of set.screenshots) {
        const headline = headlines[screenshot.headline];
        assert.ok(headline, `${locale.appLocale} ${screenshot.headline}`);
        assert.equal(headline.includes("\n"), false, `${locale.appLocale} ${screenshot.headline}`);
        assert.equal(/\d/.test(headline), false, `${locale.appLocale} ${screenshot.headline} must not quote prices`);
      }
    }
  }
});

test("Arabic and Urdu headlines render right to left", () => {
  assert.equal(headlineFontFor("ar").direction, "rtl");
  assert.equal(headlineFontFor("ur").direction, "rtl");
  assert.equal(headlineFontFor("en").direction, "ltr");
});

test("every screenshot has a verified capture in each app language", () => {
  for (const set of screenshotSets) {
    for (const locale of storeLocales) {
      for (const { screen } of set.screenshots) {
        const capturePath = captureRelativePath(set, locale.appLocale, screen);
        assert.equal(existsSync(join(mobileRoot, capturePath)), true, capturePath);
      }
    }
  }
});

test("green placeholder detection handles every Option B composition", { skip: !hasImageMagick }, () => {
  for (const set of screenshotSets) {
    const compositions = new Set(set.screenshots.map(({ composition }) => composition));
    for (const composition of compositions) {
      const compositionPath = join(mobileRoot, set.compositionDirectory, composition);
      assert.equal(existsSync(compositionPath), true, composition);
      const placeholder = findPlaceholder(compositionPath);
      const compositionSize = readPngSize(compositionPath);
      assert.ok(placeholder.width > 500, composition);
      assert.ok(placeholder.height > 1_000, composition);
      assert.ok(placeholder.x >= 0, composition);
      assert.ok(placeholder.y >= 0, composition);
      assert.ok(placeholder.width < compositionSize.width * 0.8, composition);
      assert.ok(placeholder.height > compositionSize.height * 0.6, composition);
    }
  }
});
