#!/usr/bin/env node
// cspell:ignore magick

import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const mobileRoot = join(repoRoot, "apps", "mobile");
const screenshotRedesignMarkerPath = join(
  mobileRoot,
  "store-assets",
  "SCREENSHOTS_PENDING_REDESIGN.md",
);
const placeholderColor = "#00FF00";
const placeholderFuzz = "15%";
const panelHueMask = "g > r * 1.2 && g > b * 1.2 && g > 0 ? 1 : 0";
const placeholderCleanupMargin = 6;
const screenshotSets = [
  {
    height: 2868,
    outputDirectory: "fastlane/metadata/en-US/screenshots",
    width: 1320,
    compositionDirectory: "store-assets/source/store-screenshot-compositions/option-b/ios",
    screenshots: [
      ["ios-01-live-translation.png", "store-assets/source/screenshots/ios/ios-caption-dark.png", "01-live-translation.png"],
      ["ios-02-follow-live.png", "store-assets/source/screenshots/ios/ios-welcome-dark.png", "02-follow-live.png"],
      ["ios-03-choose-language.png", "store-assets/source/screenshots/ios/ios-language-picker-dark.png", "03-choose-language.png"],
      ["ios-04-no-account.png", "store-assets/source/screenshots/ios/ios-privacy-dark.png", "04-no-account.png"],
      ["ios-05-privacy-controls.png", "store-assets/source/screenshots/ios/ios-settings-dark.png", "05-privacy-controls.png"],
      ["ios-06-choose-audio.png", "store-assets/source/screenshots/ios/ios-translation-muted-dark.png", "06-choose-audio.png"],
      ["ios-07-tap-listen.png", "store-assets/source/screenshots/ios/ios-languages-dark.png", "07-set-direction.png"],
    ],
  },
  {
    height: 1920,
    mirrorOutputDirectory: "fastlane/metadata/android/en-GB/images/phoneScreenshots",
    outputDirectory: "fastlane/metadata/android/en-US/images/phoneScreenshots",
    width: 1080,
    compositionDirectory: "store-assets/source/store-screenshot-compositions/option-b/android",
    screenshots: [
      ["android-01-live-translation.png", "store-assets/source/screenshots/android-captures/android-translation-dark.png", "01-live-translation.png"],
      ["android-02-follow-live.png", "store-assets/source/screenshots/android-captures/android-welcome-dark.png", "02-follow-live.png"],
      ["android-03-choose-language.png", "store-assets/source/screenshots/android-captures/android-picker-dark.png", "03-choose-language.png"],
      ["android-04-no-account.png", "store-assets/source/screenshots/android-captures/android-privacy-dark.png", "04-no-account.png"],
      ["android-05-choose-audio.png", "store-assets/source/screenshots/android-captures/android-translation-muted-dark.png", "05-choose-audio.png"],
    ],
  },
];

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}

export { findPlaceholder, readPngSize, renderScreenshot, screenshotSets };

function main() {
  if (existsSync(screenshotRedesignMarkerPath)) {
    console.error("Store screenshot generation is paused while the screenshot redesign is pending.");
    process.exit(1);
  }

  const temporaryDirectory = mkdtempSync(join(tmpdir(), "murmur-store-screenshots-"));
  try {
    requireCommand("magick");
    generateScreenshotSets(temporaryDirectory);
    console.log("Store screenshots generated with verified app captures in generated compositions.");
  } finally {
    rmSync(temporaryDirectory, { force: true, recursive: true });
  }
}

function generateScreenshotSets(temporaryDirectory) {
  for (const set of screenshotSets) {
    generateScreenshotSet(set, temporaryDirectory);
  }
}

function generateScreenshotSet(set, temporaryDirectory) {
  const outputDirectory = ensureOutputDirectory(set.outputDirectory);
  ensureMirrorDirectory(set.mirrorOutputDirectory);
  for (const screenshot of set.screenshots) {
    generateScreenshot(set, screenshot, outputDirectory, temporaryDirectory);
  }
}

function generateScreenshot(set, screenshot, outputDirectory, temporaryDirectory) {
  const [composition, source, target] = screenshot;
  const compositionPath = join(mobileRoot, set.compositionDirectory, composition);
  const sourcePath = join(mobileRoot, source);
  assertInput(compositionPath, `Missing generated screenshot composition: ${composition}`);
  assertInput(sourcePath, `Missing verified source screenshot: ${source}`);

  const outputPath = join(outputDirectory, target);
  renderScreenshot({
    compositionPath,
    height: set.height,
    outputPath,
    sourcePath,
    temporaryDirectory,
    width: set.width,
  });
  mirrorScreenshot(set.mirrorOutputDirectory, target, outputPath);
}

function ensureOutputDirectory(relativeDirectory) {
  const outputDirectory = join(mobileRoot, relativeDirectory);
  mkdirSync(outputDirectory, { recursive: true });
  return outputDirectory;
}

function ensureMirrorDirectory(relativeDirectory) {
  if (relativeDirectory) {
    ensureOutputDirectory(relativeDirectory);
  }
}

function assertInput(filePath, message) {
  if (!existsSync(filePath)) {
    throw new Error(message);
  }
}

function mirrorScreenshot(relativeDirectory, target, outputPath) {
  if (relativeDirectory) {
    copyFileSync(outputPath, join(mobileRoot, relativeDirectory, target));
  }
}

function renderScreenshot({ compositionPath, height, outputPath, sourcePath, temporaryDirectory, width }) {
  const compositionSize = readPngSize(compositionPath);
  const placeholder = findPlaceholder(compositionPath);
  const panel = scalePlaceholder(placeholder, compositionSize, { height, width });
  const cleanupPanel = expandPanel(panel, { height, width }, placeholderCleanupMargin);
  const fileStem = basename(outputPath, ".png");
  const basePath = join(temporaryDirectory, `${fileStem}-base.png`);
  const capturePath = join(temporaryDirectory, `${fileStem}-capture.png`);
  const maskPath = join(temporaryDirectory, `${fileStem}-mask.png`);
  const cleanupMaskPath = join(temporaryDirectory, `${fileStem}-cleanup-mask.png`);
  const fillPath = join(temporaryDirectory, `${fileStem}-fill.png`);
  const cleanBasePath = join(temporaryDirectory, `${fileStem}-clean-base.png`);
  const maskedCapturePath = join(temporaryDirectory, `${fileStem}-masked-capture.png`);

  runMagick(
    [
      compositionPath,
      "-resize",
      `${width}x${height}!`,
      "-colorspace",
      "sRGB",
      "-depth",
      "8",
      "-alpha",
      "off",
      "-strip",
      basePath,
    ],
    `format generated composition for ${outputPath}`,
  );
  runMagick(
    [
      basePath,
      "-crop",
      `${panel.width}x${panel.height}+${panel.x}+${panel.y}`,
      "+repage",
      "-alpha",
      "off",
      "-channel",
      "RGB",
      "-fx",
      panelHueMask,
      "+channel",
      "-colorspace",
      "gray",
      "-depth",
      "8",
      "-strip",
      maskPath,
    ],
    `build rounded product mask for ${outputPath}`,
  );
  runMagick(
    [
      basePath,
      "-crop",
      `${cleanupPanel.width}x${cleanupPanel.height}+${cleanupPanel.x}+${cleanupPanel.y}`,
      "+repage",
      "-alpha",
      "off",
      "-channel",
      "RGB",
      "-fx",
      panelHueMask,
      "+channel",
      "-colorspace",
      "gray",
      "-depth",
      "8",
      "-strip",
      cleanupMaskPath,
    ],
    `build placeholder cleanup mask for ${outputPath}`,
  );
  runMagick(
    [
      "-size",
      `${cleanupPanel.width}x${cleanupPanel.height}`,
      "xc:#161513",
      cleanupMaskPath,
      "-compose",
      "CopyOpacity",
      "-composite",
      fillPath,
    ],
    `prepare product panel for ${outputPath}`,
  );
  runMagick(
    [
      basePath,
      fillPath,
      "-geometry",
      `+${cleanupPanel.x}+${cleanupPanel.y}`,
      "-compose",
      "Over",
      "-composite",
      "-colorspace",
      "sRGB",
      "-depth",
      "8",
      "-alpha",
      "off",
      "-strip",
      cleanBasePath,
    ],
    `clear product placeholder for ${outputPath}`,
  );
  runMagick(
    [
      sourcePath,
      "-resize",
      `${panel.width}x${panel.height}^`,
      "-gravity",
      "center",
      "-crop",
      `${panel.width}x${panel.height}+0+0`,
      "+repage",
      "-colorspace",
      "sRGB",
      "-depth",
      "8",
      "-alpha",
      "off",
      "-strip",
      capturePath,
    ],
    `crop verified capture for ${outputPath}`,
  );
  runMagick(
    [
      capturePath,
      maskPath,
      "-compose",
      "CopyOpacity",
      "-composite",
      maskedCapturePath,
    ],
    `apply rounded product mask for ${outputPath}`,
  );
  runMagick(
    [
      cleanBasePath,
      maskedCapturePath,
      "-geometry",
      `+${panel.x}+${panel.y}`,
      "-compose",
      "Over",
      "-composite",
      "-colorspace",
      "sRGB",
      "-depth",
      "8",
      "-alpha",
      "off",
      "-strip",
      "-define",
      "png:color-type=2",
      outputPath,
    ],
    `insert verified capture for ${outputPath}`,
  );
}

function findPlaceholder(compositionPath) {
  const result = spawnSync(
    "magick",
    [
      compositionPath,
      "-alpha",
      "off",
      "-fuzz",
      placeholderFuzz,
      "-fill",
      "none",
      "+opaque",
      placeholderColor,
      "-trim",
      "-format",
      "%wx%h%O",
      "info:",
    ],
    { encoding: "utf8" },
  );
  if (result.status !== 0) {
    throw new Error(`Could not locate product placeholder in ${compositionPath}: ${result.stderr.trim()}`);
  }
  const match = result.stdout.trim().match(/^(\d+)x(\d+)\+(\d+)\+(\d+)$/);
  if (!match) {
    throw new Error(`Could not parse product placeholder bounds for ${compositionPath}: ${result.stdout.trim()}`);
  }
  const [, width, height, x, y] = match;
  return { height: Number(height), width: Number(width), x: Number(x), y: Number(y) };
}

function readPngSize(filePath) {
  const source = readFileSync(filePath);
  return { height: source.readUInt32BE(20), width: source.readUInt32BE(16) };
}

function requireCommand(command) {
  const result = spawnSync(command, ["-version"], { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`${command} is required to build store screenshots.`);
  }
}

function runMagick(args, action) {
  const result = spawnSync("magick", args, { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`ImageMagick failed to ${action}: ${result.stderr.trim()}`);
  }
}

function scalePlaceholder(placeholder, compositionSize, targetSize) {
  const x = scalePosition(placeholder.x, compositionSize.width, targetSize.width);
  const y = scalePosition(placeholder.y, compositionSize.height, targetSize.height);
  const width = scaleDimension(placeholder.width, compositionSize.width, targetSize.width, x, targetSize.width);
  const height = scaleDimension(placeholder.height, compositionSize.height, targetSize.height, y, targetSize.height);
  const panel = { height, width, x, y };
  assertPanelCoordinate(panel.x, "x", panel);
  assertPanelCoordinate(panel.y, "y", panel);
  assertPanelDimension(panel.width, "width", panel);
  assertPanelDimension(panel.height, "height", panel);
  return panel;
}

function scalePosition(value, sourceLength, targetLength) {
  return Math.round((value * targetLength) / sourceLength);
}

function scaleDimension(value, sourceLength, targetLength, position, targetLengthLimit) {
  const scaled = scalePosition(value, sourceLength, targetLength);
  return Math.min(scaled, targetLengthLimit - position);
}

function assertPanelCoordinate(value, axis, panel) {
  if (value < 0) {
    throw new Error(`Product placeholder is outside target bounds: ${axis}=${value}; panel=${JSON.stringify(panel)}`);
  }
}

function assertPanelDimension(value, axis, panel) {
  if (value <= 0) {
    throw new Error(`Product placeholder is outside target bounds: ${axis}=${value}; panel=${JSON.stringify(panel)}`);
  }
}

function expandPanel(panel, targetSize, margin) {
  const x = Math.max(0, panel.x - margin);
  const y = Math.max(0, panel.y - margin);
  const right = Math.min(targetSize.width, panel.x + panel.width + margin);
  const bottom = Math.min(targetSize.height, panel.y + panel.height + margin);
  return { height: bottom - y, width: right - x, x, y };
}
