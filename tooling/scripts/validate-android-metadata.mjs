#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const mobileRoot = join(repoRoot, "apps", "mobile");
const metadataDir = join(mobileRoot, "fastlane", "metadata", "android");
const locales = ["en-US", "en-GB"];
const failures = [];

const assert = (condition, message) => {
  if (!condition) {
    failures.push(message);
  }
};

const read = (locale, relativePath) =>
  readFileSync(join(metadataDir, locale, relativePath), "utf8").trim();

const assertLength = (label, value, max) => {
  assert(value.length > 0, `${label} must not be empty`);
  assert(value.length <= max, `${label} must be <= ${max} chars; got ${value.length}`);
};

const pngSize = (filePath) => {
  const buffer = readFileSync(filePath);
  const signature = buffer.subarray(0, 8).toString("hex");
  assert(signature === "89504e470d0a1a0a", `${filePath} must be a PNG`);
  if (signature !== "89504e470d0a1a0a") {
    return { width: 0, height: 0 };
  }

  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
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
  assert(existsSync(featureGraphicPath), `${locale} feature graphic must exist`);
  if (existsSync(featureGraphicPath)) {
    const { width, height } = pngSize(featureGraphicPath);
    assert(width === 1024 && height === 500, `${locale} feature graphic must be 1024x500; got ${width}x${height}`);
  }

  const screenshotDir = join(localeDir, "images", "phoneScreenshots");
  assert(existsSync(screenshotDir), `${locale} phone screenshots directory must exist`);
  if (existsSync(screenshotDir)) {
    const screenshots = readdirSync(screenshotDir)
      .filter((fileName) => /\.png$/i.test(fileName))
      .sort();
    assert(screenshots.length >= 2, `${locale} must include at least 2 phone screenshots`);
    assert(screenshots.length <= 8, `${locale} must include no more than 8 phone screenshots`);
    for (const screenshot of screenshots) {
      const screenshotPath = join(screenshotDir, screenshot);
      const { width, height } = pngSize(screenshotPath);
      assert(
        Math.min(width, height) >= 320,
        `${locale} ${screenshot} min dimension must be at least 320px; got ${width}x${height}`,
      );
    }
  }
}

const usDescription = read("en-US", "full_description.txt");
const gbDescription = read("en-GB", "full_description.txt");
assert(usDescription === gbDescription, "en-US and en-GB Play full descriptions must stay mirrored for V1");

if (failures.length > 0) {
  console.error("Android metadata validation failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Android metadata validation passed.");
