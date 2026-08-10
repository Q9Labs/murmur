#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
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
const metadataDir = join(mobileRoot, "fastlane", "metadata", "android");
const screenshotRedesignPending = existsSync(
  join(mobileRoot, "store-assets", "SCREENSHOTS_PENDING_REDESIGN.md"),
);
const locales = ["en-US", "en-GB"];
const { assert, failures } = createFailureCollector();

const read = (locale, relativePath) =>
  readFileSync(join(metadataDir, locale, relativePath), "utf8").trim();

const assertLength = (label, value, max) => {
  assert(value.length > 0, `${label} must not be empty`);
  assert(value.length <= max, `${label} must be <= ${max} chars; got ${value.length}`);
};

for (const locale of locales) {
  const localeDir = join(metadataDir, locale);
  assert(existsSync(localeDir), `${locale} metadata directory must exist`);

  const title = read(locale, "title.txt");
  const shortDescription = read(locale, "short_description.txt");
  const fullDescription = read(locale, "full_description.txt");
  const releaseNotes = read(locale, join("changelogs", "default.txt"));

  assertLength(`${locale} title`, title, 30);
  assertLength(`${locale} short description`, shortDescription, 80);
  assertLength(`${locale} full description`, fullDescription, 4000);
  assertLength(`${locale} release notes`, releaseNotes, 500);

  const combinedCopy = [title, shortDescription, fullDescription, releaseNotes].join("\n");
  assert(
    !/\btap Start\b/i.test(combinedCopy),
    `${locale} Play metadata must say tap Listen, not tap Start`,
  );
  assert(
    /\btap Listen\b/i.test(combinedCopy),
    `${locale} Play metadata must include the real first-session CTA: tap Listen`,
  );
  assert(/accountless|no login/i.test(combinedCopy), `${locale} Play metadata must mention accountless/no-login use`);
  assert(/AI output can be incomplete or inaccurate/i.test(combinedCopy), `${locale} Play metadata must disclose AI output limits`);

  const featureGraphicPath = join(localeDir, "images", "featureGraphic", "feature-graphic.png");
  const featureGraphicValidation = validatePngFile({
    expectedHeight: 500,
    expectedWidth: 1024,
    filePath: featureGraphicPath,
    label: `${locale} feature graphic`,
  });
  failures.push(...featureGraphicValidation.failures);

  const screenshotDir = join(localeDir, "images", "phoneScreenshots");
  const screenshotValidation = validatePngDirectory({
    directory: screenshotDir,
    expectedCount: screenshotRedesignPending ? undefined : androidScreenshotSpec.count,
    expectedHeight: screenshotRedesignPending ? undefined : androidScreenshotSpec.height,
    expectedWidth: screenshotRedesignPending ? undefined : androidScreenshotSpec.width,
    directoryLabel: `${locale} phone screenshots`,
    label: locale,
    minDimension: true,
    playLimits: !screenshotRedesignPending,
    requireDirectory: !screenshotRedesignPending,
    requireOpaque: !screenshotRedesignPending,
    requireRgb: !screenshotRedesignPending,
  });
  failures.push(...screenshotValidation.failures);
}

if (screenshotRedesignPending) {
  console.log("Android screenshot validation skipped while the screenshot redesign is pending.");
}

const usDescription = read("en-US", "full_description.txt");
const gbDescription = read("en-GB", "full_description.txt");
assert(usDescription === gbDescription, "en-US and en-GB Play full descriptions must stay mirrored for V1");

if (!screenshotRedesignPending) {
  failures.push(
    ...comparePngDirectories({
      leftDirectory: join(metadataDir, "en-US", "images", "phoneScreenshots"),
      leftLabel: "en-US Play",
      rightDirectory: join(metadataDir, "en-GB", "images", "phoneScreenshots"),
      rightLabel: "en-GB Play",
    }),
  );
}

if (failures.length > 0) {
  console.error("Android metadata validation failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Android metadata validation passed.");
