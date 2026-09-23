#!/usr/bin/env node

import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { storeLocales } from "./build-store-screenshots.mjs";
import {
  androidScreenshotSpec,
  comparePngDirectories,
  createFailureCollector,
  iosScreenshotSpec,
  validatePngDirectory,
  validatePngFile,
} from "./store-screenshot-validation.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const mobileRoot = join(repoRoot, "apps", "mobile");
const screenshotRedesignPending = existsSync(
  join(mobileRoot, "store-assets", "SCREENSHOTS_PENDING_REDESIGN.md"),
);
const { assert, failures } = createFailureCollector();

const assertImage = (relativePath, expectedWidth, expectedHeight, { allowAlpha = false } = {}) => {
  const validation = validatePngFile({
    expectedHeight: expectedHeight,
    expectedWidth,
    filePath: join(mobileRoot, relativePath),
    label: relativePath,
    requireOpaque: !allowAlpha,
  });
  failures.push(...validation.failures);
};

for (const relativePath of [
  "assets/images/icon.png",
  "assets/images/adaptive-icon.png",
  "assets/images/splash-icon.png",
]) {
  assertImage(relativePath, 1024, 1024);
}

for (const relativePath of [
  "brand/murmur-logo-2026-05-20.png",
  "google-play/app-icon-512.png",
  "google-play/feature-graphic.svg",
]) {
  assert(
    existsSync(join(mobileRoot, "store-assets", "source", relativePath)),
    `store-assets/source/${relativePath} must exist`,
  );
}

for (const locale of ["en-US", "en-GB"]) {
  assertImage(`fastlane/metadata/android/${locale}/images/featureGraphic/feature-graphic.png`, 1024, 500);

  const screenshotDir = join(mobileRoot, "fastlane", "metadata", "android", locale, "images", "phoneScreenshots");
  const screenshotValidation = validatePngDirectory({
    directory: screenshotDir,
    expectedCount: screenshotRedesignPending ? undefined : androidScreenshotSpec.count,
    expectedHeight: screenshotRedesignPending ? undefined : androidScreenshotSpec.height,
    expectedWidth: screenshotRedesignPending ? undefined : androidScreenshotSpec.width,
    directoryLabel: `${locale} phone screenshots`,
    fileLabelPrefix: `fastlane/metadata/android/${locale}/images/phoneScreenshots/`,
    label: locale,
    playLimits: true,
    requireDirectory: !screenshotRedesignPending,
    requireOpaque: !screenshotRedesignPending,
    requireRgb: !screenshotRedesignPending,
  });
  failures.push(...screenshotValidation.failures);
}

if (!screenshotRedesignPending) {
  failures.push(
    ...comparePngDirectories({
      leftDirectory: join(mobileRoot, "fastlane", "metadata", "android", "en-US", "images", "phoneScreenshots"),
      leftLabel: "en-US Play",
      rightDirectory: join(mobileRoot, "fastlane", "metadata", "android", "en-GB", "images", "phoneScreenshots"),
      rightLabel: "en-GB Play",
    }),
  );
}

// en-US and en-GB are checked above with the full Play listing; every other store locale ships the same set.
if (!screenshotRedesignPending) {
  for (const locale of storeLocales.filter(({ appLocale }) => appLocale !== "en")) {
    const iosValidation = validatePngDirectory({
      directory: join(mobileRoot, "fastlane", "metadata", locale.ios, "screenshots"),
      expectedCount: iosScreenshotSpec.count,
      expectedHeight: iosScreenshotSpec.height,
      expectedWidth: iosScreenshotSpec.width,
      directoryLabel: `${locale.ios} App Store screenshots`,
      label: locale.ios,
      requireDirectory: true,
      requireOpaque: true,
      screenshotLabel: "App Store screenshots",
    });
    failures.push(...iosValidation.failures);

    for (const code of locale.android) {
      const androidValidation = validatePngDirectory({
        directory: join(mobileRoot, "fastlane", "metadata", "android", code, "images", "phoneScreenshots"),
        expectedCount: androidScreenshotSpec.count,
        expectedHeight: androidScreenshotSpec.height,
        expectedWidth: androidScreenshotSpec.width,
        directoryLabel: `${code} phone screenshots`,
        fileLabelPrefix: `fastlane/metadata/android/${code}/images/phoneScreenshots/`,
        label: code,
        playLimits: true,
        requireDirectory: true,
        requireOpaque: true,
        requireRgb: true,
      });
      failures.push(...androidValidation.failures);
    }
  }
}

if (screenshotRedesignPending) {
  console.log("Store screenshot asset validation skipped while the screenshot redesign is pending.");
}

if (failures.length > 0) {
  console.error("Store asset validation failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Store asset validation passed.");
