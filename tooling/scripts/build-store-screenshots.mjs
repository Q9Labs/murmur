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
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const mobileRoot = join(repoRoot, "apps", "mobile");
const temporaryDirectory = mkdtempSync(join(tmpdir(), "murmur-store-screenshots-"));

const screenshotSets = [
  {
    height: 2868,
    outputDirectory: "fastlane/metadata/en-US/screenshots",
    width: 1320,
    screenshots: [
      ["ios-01-live-captions.png", "store-assets/source/screenshots/ios/ios-caption.png", "01-ios-whatsapp-latest.png"],
      ["ios-02-tours-talks.png", "store-assets/source/screenshots/ios/ios-ready.png", "02-ios-whatsapp-latest.png"],
      ["ios-03-privacy.png", "store-assets/source/screenshots/ios/ios-privacy.png", "03-ios-whatsapp-latest.png"],
      ["ios-04-language-pair.png", "store-assets/source/screenshots/ios/ios-direction.png", "04-ios-whatsapp-latest.png"],
      ["ios-05-source-language.png", "store-assets/source/screenshots/ios/ios-source-picker.png", "05-ios-whatsapp-latest.png"],
      ["ios-06-translated-captions.png", "store-assets/source/screenshots/ios/ios-target-picker.png", "06-ios-whatsapp-latest.png"],
      ["ios-07-start-listening.png", "store-assets/source/screenshots/ios/ios-welcome.png", "07-ios-whatsapp-latest.png"],
    ],
  },
  {
    height: 1920,
    mirrorOutputDirectory: "fastlane/metadata/android/en-GB/images/phoneScreenshots",
    outputDirectory: "fastlane/metadata/android/en-US/images/phoneScreenshots",
    width: 1080,
    screenshots: [
      ["android-01-live-captions.png", "store-assets/source/screenshots/android-captures/android-arabic-caption.png", "01-android-whatsapp-latest.png"],
      ["android-02-tours-talks.png", "store-assets/source/screenshots/android-captures/android-french-caption.png", "02-android-whatsapp-latest.png"],
      ["android-03-language-pair.png", "store-assets/source/screenshots/android-captures/android-direction.png", "03-android-whatsapp-latest.png"],
      ["android-04-privacy.png", "store-assets/source/screenshots/android-captures/android-privacy.png", "04-android-whatsapp-latest.png"],
      ["android-05-start-listening.png", "store-assets/source/screenshots/android-captures/android-welcome.png", "05-android-whatsapp-latest.png"],
    ],
  },
];

try {
  requireCommand("magick");

  for (const set of screenshotSets) {
    const outputDirectory = join(mobileRoot, set.outputDirectory);
    mkdirSync(outputDirectory, { recursive: true });
    if (set.mirrorOutputDirectory) {
      mkdirSync(join(mobileRoot, set.mirrorOutputDirectory), { recursive: true });
    }

    for (const [composition, source, target] of set.screenshots) {
      const compositionPath = join(
        mobileRoot,
        "store-assets/source/store-screenshot-compositions",
        composition,
      );
      const sourcePath = join(mobileRoot, source);
      if (!existsSync(compositionPath)) {
        throw new Error(`Missing generated screenshot composition: ${composition}`);
      }
      if (!existsSync(sourcePath)) {
        throw new Error(`Missing verified source screenshot: ${source}`);
      }

      const outputPath = join(outputDirectory, target);
      renderScreenshot({
        compositionPath,
        height: set.height,
        outputPath,
        sourcePath,
        width: set.width,
      });
      if (set.mirrorOutputDirectory) {
        copyFileSync(
          outputPath,
          join(mobileRoot, set.mirrorOutputDirectory, target),
        );
      }
    }
  }

  console.log("Store screenshots generated with verified app captures in generated compositions.");
} finally {
  rmSync(temporaryDirectory, { force: true, recursive: true });
}

function renderScreenshot({ compositionPath, height, outputPath, sourcePath, width }) {
  const compositionSize = readPngSize(compositionPath);
  const sourceSize = readPngSize(sourcePath);
  const placeholder = findPlaceholder(compositionPath);
  const scaleX = width / compositionSize.width;
  const scaleY = height / compositionSize.height;
  const panel = {
    height: Math.round(placeholder.height * scaleY),
    width: Math.round(placeholder.width * scaleX),
    x: Math.round(placeholder.x * scaleX),
    y: Math.round(placeholder.y * scaleY),
  };
  const captureScale = Math.min(
    panel.width / sourceSize.width,
    panel.height / sourceSize.height,
  );
  const capture = {
    height: Math.round(sourceSize.height * captureScale),
    width: Math.round(sourceSize.width * captureScale),
  };
  const captureX = panel.x + Math.round((panel.width - capture.width) / 2);
  const captureY = panel.y + Math.round((panel.height - capture.height) / 2);
  // The generated placeholder can land one or two pixels outside the rounded
  // scaled bounds. Cover that anti-aliased edge before inserting the capture.
  const panelFill = {
    height: Math.min(height - Math.max(0, panel.y - 4), panel.height + 8),
    width: Math.min(width - Math.max(0, panel.x - 4), panel.width + 8),
    x: Math.max(0, panel.x - 4),
    y: Math.max(0, panel.y - 4),
  };
  const basePath = join(temporaryDirectory, `${outputPath.split("/").at(-1)}-base.png`);
  const capturePath = join(temporaryDirectory, `${outputPath.split("/").at(-1)}-capture.png`);

  runMagick(
    [
      compositionPath,
      "-resize",
      `${width}x${height}!`,
      "-colorspace",
      "sRGB",
      "-alpha",
      "off",
      basePath,
    ],
    `format generated composition for ${outputPath}`,
  );
  runMagick(
    [sourcePath, "-resize", `${capture.width}x${capture.height}`, capturePath],
    `scale verified capture for ${outputPath}`,
  );
  runMagick(
    [
      basePath,
      "(",
      "-size",
      `${panelFill.width}x${panelFill.height}`,
      "xc:#161513",
      ")",
      "-geometry",
      `+${panelFill.x}+${panelFill.y}`,
      "-composite",
      "(",
      capturePath,
      ")",
      "-geometry",
      `+${captureX}+${captureY}`,
      "-composite",
      "-fuzz",
      "5%",
      "-fill",
      "#161513",
      "-opaque",
      "#00FF00",
      "-colorspace",
      "sRGB",
      "-depth",
      "8",
      "-alpha",
      "off",
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
      "on",
      "-fuzz",
      "5%",
      "-fill",
      "none",
      "+opaque",
      "#00FF00",
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
