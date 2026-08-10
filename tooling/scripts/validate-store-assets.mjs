#!/usr/bin/env node

import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  androidScreenshotSpec,
  comparePngDirectories,
  createFailureCollector,
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
