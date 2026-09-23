#!/usr/bin/env node
// cspell:ignore magick rsvg Geeza Kohinoor Hiragino Nastaliq Noto roundrectangle

import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { screenshotHeadlines } from "./store-screenshot-headlines.mjs";

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
const headlineColor = "#F9F6EE";
const pngExtension = /\.png$/i;

// Each app language maps to the store locales that show its screenshots.
// Store locale names follow the store-listing localization (App Store, Google Play).
const storeLocales = [
  { android: ["en-US", "en-GB"], appLocale: "en", ios: "en-US" },
  { android: ["ar"], appLocale: "ar", ios: "ar-SA" },
  { android: ["de-DE"], appLocale: "de", ios: "de-DE" },
  { android: ["es-419"], appLocale: "es", ios: "es-MX" },
  { android: ["fr-FR"], appLocale: "fr", ios: "fr-FR" },
  { android: ["hi-IN"], appLocale: "hi", ios: "hi" },
  { android: ["id"], appLocale: "id", ios: "id" },
  { android: ["ja-JP"], appLocale: "ja", ios: "ja" },
  { android: ["pt-BR"], appLocale: "pt-BR", ios: "pt-BR" },
  { android: ["tr-TR"], appLocale: "tr", ios: "tr" },
  { android: ["ur"], appLocale: "ur", ios: "ur-PK" },
];

const defaultHeadlineFont = { direction: "ltr", family: "Helvetica Neue", weight: 700 };
const headlineFonts = {
  ar: { direction: "rtl", family: "Geeza Pro", weight: 700 },
  hi: { direction: "ltr", family: "Kohinoor Devanagari", weight: 600 },
  ja: { direction: "ltr", family: "Hiragino Sans", weight: 600 },
  ur: { direction: "rtl", family: "Noto Nastaliq Urdu", weight: 700 },
};

// Headline placement as fractions of the output canvas: the band the compositions reserve above the phone.
const screenshotSets = [
  {
    captureDirectory: "store-assets/source/screenshots/ios",
    compositionDirectory: "store-assets/source/store-screenshot-compositions/option-b/ios",
    screenCornerRadius: 0.095,
    headlineLayout: { centerY: 0.162, fontSize: 0.058, marginX: 0.082, maxWidth: 0.76 },
    height: 2868,
    outputDirectories: (locale) => [`fastlane/metadata/${locale.ios}/screenshots`],
    platform: "ios",
    screenshots: [
      { composition: "ios-01.png", headline: "live", screen: "translation", target: "01-live-translation.png" },
      { composition: "ios-03.png", headline: "languages", screen: "picker", target: "02-choose-languages.png" },
      {
        composition: "ios-06.png",
        headline: "spokenTranslation",
        screen: "translation-only",
        target: "03-hear-translation.png",
      },
      {
        composition: "ios-02.png",
        headline: "background",
        screen: "translation-background",
        target: "04-background-listening.png",
      },
      { composition: "ios-04.png", headline: "plans", screen: "plans-packs", target: "05-plans.png" },
      { composition: "ios-05.png", headline: "privacy", screen: "privacy", target: "06-privacy.png" },
      { composition: "ios-07.png", headline: "noAccount", screen: "account-guest", target: "07-no-account.png" },
      { composition: "ios-01.png", headline: "appLanguage", screen: "app-language", target: "08-app-language.png" },
    ],
    width: 1320,
  },
  {
    captureDirectory: "store-assets/source/screenshots/android",
    compositionDirectory: "store-assets/source/store-screenshot-compositions/option-b/android",
    screenCornerRadius: 0.045,
    headlineLayout: { centerY: 0.19, fontSize: 0.058, marginX: 0.089, maxWidth: 0.76 },
    height: 1920,
    outputDirectories: (locale) =>
      locale.android.map((code) => `fastlane/metadata/android/${code}/images/phoneScreenshots`),
    platform: "android",
    screenshots: [
      { composition: "android-01.png", headline: "live", screen: "translation", target: "01-live-translation.png" },
      { composition: "android-03.png", headline: "languages", screen: "picker", target: "02-choose-languages.png" },
      {
        composition: "android-05.png",
        headline: "phoneAudio",
        screen: "translation-phone-audio",
        target: "03-phone-audio.png",
      },
      {
        composition: "android-02.png",
        headline: "background",
        screen: "translation-background",
        target: "04-background-listening.png",
      },
      { composition: "android-04.png", headline: "plans", screen: "plans-packs", target: "05-plans.png" },
      { composition: "android-01.png", headline: "privacy", screen: "privacy", target: "06-privacy.png" },
      { composition: "android-03.png", headline: "noAccount", screen: "account-guest", target: "07-no-account.png" },
      { composition: "android-05.png", headline: "appLanguage", screen: "app-language", target: "08-app-language.png" },
    ],
    width: 1080,
  },
];

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2));
}

export {
  captureRelativePath,
  findPlaceholder,
  headlineFontFor,
  readPngSize,
  renderScreenshot,
  screenshotHeadlines,
  screenshotSets,
  storeLocales,
};

// Optional arguments limit the run to those app locales, e.g. `node build-store-screenshots.mjs en ar`.
function main(requestedLocales) {
  if (existsSync(screenshotRedesignMarkerPath)) {
    console.error("Store screenshot generation is paused while the screenshot redesign is pending.");
    process.exit(1);
  }

  const locales = selectLocales(requestedLocales);
  const temporaryDirectory = mkdtempSync(join(tmpdir(), "murmur-store-screenshots-"));
  try {
    requireCommand("magick");
    requireCommand("rsvg-convert", "--version");
    for (const set of screenshotSets) {
      generateLocalizedSets(set, locales, temporaryDirectory);
    }
    console.log("Store screenshots generated with verified app captures and localized headlines.");
  } finally {
    rmSync(temporaryDirectory, { force: true, recursive: true });
  }
}

function selectLocales(requestedLocales) {
  if (requestedLocales.length === 0) {
    return storeLocales;
  }
  return requestedLocales.map((appLocale) => {
    const locale = storeLocales.find((candidate) => candidate.appLocale === appLocale);
    if (!locale) {
      throw new Error(`Unknown app locale for store screenshots: ${appLocale}`);
    }
    return locale;
  });
}

function generateLocalizedSets(set, locales, temporaryDirectory) {
  for (const locale of locales) {
    generateScreenshotSet(set, locale, temporaryDirectory);
  }
}

function captureRelativePath(set, appLocale, screen) {
  return `${set.captureDirectory}/${appLocale}/${screen}.png`;
}

function headlineFontFor(appLocale) {
  return headlineFonts[appLocale] ?? defaultHeadlineFont;
}

function generateScreenshotSet(set, locale, temporaryDirectory) {
  const headlines = screenshotHeadlines[locale.appLocale];
  if (!headlines) {
    throw new Error(`Missing screenshot headlines for ${locale.appLocale}`);
  }
  const [outputDirectory, ...mirrorDirectories] = set.outputDirectories(locale).map(resetOutputDirectory);
  for (const screenshot of set.screenshots) {
    const outputPath = join(outputDirectory, screenshot.target);
    generateScreenshot({ headlines, locale, outputPath, screenshot, set, temporaryDirectory });
    for (const mirrorDirectory of mirrorDirectories) {
      copyFileSync(outputPath, join(mirrorDirectory, screenshot.target));
    }
  }
}

function generateScreenshot({ headlines, locale, outputPath, screenshot, set, temporaryDirectory }) {
  const compositionPath = join(mobileRoot, set.compositionDirectory, screenshot.composition);
  const sourceRelativePath = captureRelativePath(set, locale.appLocale, screenshot.screen);
  const sourcePath = join(mobileRoot, sourceRelativePath);
  const headline = headlines[screenshot.headline];
  assertInput(compositionPath, `Missing generated screenshot composition: ${screenshot.composition}`);
  assertInput(sourcePath, `Missing verified source screenshot: ${sourceRelativePath}`);
  if (!headline) {
    throw new Error(`Missing ${locale.appLocale} headline: ${screenshot.headline}`);
  }

  const stem = `${set.platform}-${locale.appLocale}-${basename(screenshot.target, ".png")}`;
  const workDirectory = join(temporaryDirectory, stem);
  mkdirSync(workDirectory);
  const productPath = join(workDirectory, "product.png");
  const font = headlineFontFor(locale.appLocale);
  renderScreenshot({
    compositionPath: orientComposition(compositionPath, font, workDirectory),
    cornerRadiusRatio: set.screenCornerRadius,
    height: set.height,
    outputPath: productPath,
    sourcePath,
    temporaryDirectory: workDirectory,
    width: set.width,
  });
  addHeadline({
    font,
    headline,
    inputPath: productPath,
    layout: set.headlineLayout,
    outputPath,
    size: { height: set.height, width: set.width },
    workDirectory,
  });
}

// Right-to-left headlines sit at the right edge, so the decorative arcs move to the left.
function orientComposition(compositionPath, font, workDirectory) {
  if (font.direction !== "rtl") {
    return compositionPath;
  }
  const mirroredPath = join(workDirectory, "composition-mirrored.png");
  runMagick([compositionPath, "-flop", mirroredPath], `mirror ${compositionPath}`);
  return mirroredPath;
}

// Stale PNGs from an older screenshot list must not ship next to the current set.
function resetOutputDirectory(relativeDirectory) {
  const outputDirectory = join(mobileRoot, relativeDirectory);
  mkdirSync(outputDirectory, { recursive: true });
  for (const file of readdirSync(outputDirectory)) {
    if (pngExtension.test(file)) {
      rmSync(join(outputDirectory, file));
    }
  }
  return outputDirectory;
}

function assertInput(filePath, message) {
  if (!existsSync(filePath)) {
    throw new Error(message);
  }
}

function addHeadline({ font, headline, inputPath, layout, outputPath, size, workDirectory }) {
  const fontSize = Math.round(size.width * layout.fontSize);
  const maxWidth = Math.round(size.width * layout.maxWidth);
  const svgPath = join(workDirectory, "headline.svg");
  const rasterPath = join(workDirectory, "headline-raster.png");
  const fittedPath = join(workDirectory, "headline.png");
  writeFileSync(svgPath, headlineSvg({ font, fontSize, headline }));
  runCommand("rsvg-convert", ["--output", rasterPath, svgPath], `render headline for ${outputPath}`);
  runMagick(
    [
      rasterPath,
      "-define",
      "trim:edges=east,west",
      "-trim",
      "+repage",
      "-resize",
      `${maxWidth}x>`,
      fittedPath,
    ],
    `fit headline for ${outputPath}`,
  );
  const headlineSize = readPngSize(fittedPath);
  const marginX = Math.round(size.width * layout.marginX);
  const x = font.direction === "rtl" ? size.width - marginX - headlineSize.width : marginX;
  const y = Math.round(size.height * layout.centerY - headlineSize.height / 2);
  runMagick(
    [
      inputPath,
      fittedPath,
      "-geometry",
      `+${x}+${y}`,
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
    `place headline for ${outputPath}`,
  );
}

// The canvas is wide enough for any single line; the fit step trims and scales it to the layout.
function headlineSvg({ font, fontSize, headline }) {
  const width = fontSize * 40;
  const height = Math.round(fontSize * 2.6);
  const baseline = Math.round(fontSize * 1.6);
  const anchor = font.direction === "rtl" ? `x="${width - fontSize}" direction="rtl"` : `x="${fontSize}"`;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">`,
    `<text ${anchor} y="${baseline}" text-anchor="start" font-family="${font.family}" font-weight="${font.weight}"`,
    ` font-size="${fontSize}" fill="${headlineColor}">${escapeXml(headline)}</text>`,
    "</svg>",
  ].join("");
}

function escapeXml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function runCommand(command, args, action) {
  const result = spawnSync(command, args, { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`${command} failed to ${action}: ${commandError(result)}`);
  }
}

// The capture gets a smooth geometric corner; the generated placeholder edge is too noisy to reuse as a mask.
function renderScreenshot({
  compositionPath,
  cornerRadiusRatio,
  height,
  outputPath,
  sourcePath,
  temporaryDirectory,
  width,
}) {
  const compositionSize = readPngSize(compositionPath);
  const placeholder = findPlaceholder(compositionPath);
  const panel = scalePlaceholder(placeholder, compositionSize, { height, width });
  const cleanupPanel = expandPanel(panel, { height, width }, placeholderCleanupMargin);
  const cornerRadius = Math.round(panel.width * cornerRadiusRatio);
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
      "-size",
      `${panel.width}x${panel.height}`,
      "xc:black",
      "-fill",
      "white",
      "-draw",
      `roundrectangle 0,0 ${panel.width - 1},${panel.height - 1} ${cornerRadius},${cornerRadius}`,
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
    throw new Error(`Could not locate product placeholder in ${compositionPath}: ${commandError(result)}`);
  }
  const output = commandOutput(result);
  const match = output.match(/^(\d+)x(\d+)\+(\d+)\+(\d+)$/);
  if (!match) {
    throw new Error(`Could not parse product placeholder bounds for ${compositionPath}: ${output}`);
  }
  const [, width, height, x, y] = match;
  return { height: Number(height), width: Number(width), x: Number(x), y: Number(y) };
}

function commandError(result) {
  return String(result.stderr ?? result.error?.message ?? "unknown error").trim();
}

function commandOutput(result) {
  return String(result.stdout ?? "").trim();
}

function readPngSize(filePath) {
  const source = readFileSync(filePath);
  return { height: source.readUInt32BE(20), width: source.readUInt32BE(16) };
}

function requireCommand(command, versionFlag = "-version") {
  const result = spawnSync(command, [versionFlag], { encoding: "utf8" });
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
