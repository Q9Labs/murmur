#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const failures = [];

const assert = (condition, message) => {
  if (!condition) {
    failures.push(message);
  }
};

const readPng = (relativePath) => {
  const filePath = join(root, relativePath);
  assert(existsSync(filePath), `${relativePath} must exist`);
  if (!existsSync(filePath)) {
    return { hasAlpha: "unknown", height: 0, width: 0 };
  }

  const png = readFileSync(filePath);
  const signature = "89504e470d0a1a0a";
  assert(png.subarray(0, 8).toString("hex") === signature, `${relativePath} must be a PNG`);
  const width = png.readUInt32BE(16);
  const height = png.readUInt32BE(20);
  const colorType = png[25];
  const hasAlpha = colorType === 4 || colorType === 6 || png.includes(Buffer.from("tRNS")) ? "yes" : "no";
  return { hasAlpha, height, width };
};

const assertImage = (relativePath, expectedWidth, expectedHeight, { allowAlpha = false } = {}) => {
  const image = readPng(relativePath);
  assert(
    image.width === expectedWidth && image.height === expectedHeight,
    `${relativePath} must be ${expectedWidth}x${expectedHeight}; got ${image.width}x${image.height}`,
  );
  if (!allowAlpha) {
    assert(image.hasAlpha === "no", `${relativePath} must not have alpha; got hasAlpha=${image.hasAlpha}`);
  }
};

const assertPlayPhoneScreenshot = (relativePath) => {
  const image = readPng(relativePath);
  const shortSide = Math.min(image.width, image.height);
  const longSide = Math.max(image.width, image.height);

  assert(shortSide >= 320, `${relativePath} short side must be at least 320px; got ${shortSide}`);
  assert(longSide <= 3840, `${relativePath} long side must be no more than 3840px; got ${longSide}`);
  assert(longSide / shortSide <= 2.3, `${relativePath} aspect ratio must be 2.3:1 or less; got ${longSide}:${shortSide}`);
  assert(image.height > image.width, `${relativePath} must be a portrait phone screenshot; got ${image.width}x${image.height}`);
};

for (const relativePath of [
  "assets/images/icon.png",
  "assets/images/adaptive-icon.png",
  "assets/images/splash-icon.png",
]) {
  assertImage(relativePath, 1024, 1024);
}

for (const locale of ["en-US", "en-GB"]) {
  assertImage(`fastlane/metadata/android/${locale}/images/featureGraphic/feature-graphic.png`, 1024, 500);

  const screenshotDir = join(root, "fastlane", "metadata", "android", locale, "images", "phoneScreenshots");
  assert(existsSync(screenshotDir), `${locale} phone screenshot directory must exist`);
  if (!existsSync(screenshotDir)) {
    continue;
  }

  const screenshots = readdirSync(screenshotDir).filter((fileName) => /\.png$/i.test(fileName)).sort();
  assert(screenshots.length === 5, `${locale} must include the current 5 phone screenshots; got ${screenshots.length}`);
  for (const screenshot of screenshots) {
    assertPlayPhoneScreenshot(`fastlane/metadata/android/${locale}/images/phoneScreenshots/${screenshot}`);
  }
}

if (failures.length > 0) {
  console.error("Store asset validation failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Store asset validation passed.");
