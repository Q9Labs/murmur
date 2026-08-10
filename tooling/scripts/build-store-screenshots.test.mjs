import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { findPlaceholder, readPngSize, screenshotSets } from "./build-store-screenshots.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const mobileRoot = join(repoRoot, "apps", "mobile");

test("Option B mappings use the published screenshot names and mirrored Android set", () => {
  const [ios, android] = screenshotSets;

  assert.deepEqual(
    ios.screenshots.map(([, source, target]) => [source.split("/").at(-1), target]),
    [
      ["ios-caption-dark.png", "01-live-translation.png"],
      ["ios-welcome-dark.png", "02-follow-live.png"],
      ["ios-language-picker-dark.png", "03-choose-language.png"],
      ["ios-privacy-dark.png", "04-no-account.png"],
      ["ios-settings-dark.png", "05-privacy-controls.png"],
      ["ios-translation-muted-dark.png", "06-choose-audio.png"],
      ["ios-languages-dark.png", "07-set-direction.png"],
    ],
  );
  assert.deepEqual(
    android.screenshots.map(([, source, target]) => [source.split("/").at(-1), target]),
    [
      ["android-translation-dark.png", "01-live-translation.png"],
      ["android-welcome-dark.png", "02-follow-live.png"],
      ["android-picker-dark.png", "03-choose-language.png"],
      ["android-privacy-dark.png", "04-no-account.png"],
      ["android-translation-muted-dark.png", "05-choose-audio.png"],
    ],
  );
  assert.equal(android.mirrorOutputDirectory, "fastlane/metadata/android/en-GB/images/phoneScreenshots");
  assert.equal(ios.width, 1320);
  assert.equal(ios.height, 2868);
  assert.equal(android.width, 1080);
  assert.equal(android.height, 1920);
});

test("green placeholder detection handles every Option B composition", () => {
  for (const set of screenshotSets) {
    for (const [composition] of set.screenshots) {
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
