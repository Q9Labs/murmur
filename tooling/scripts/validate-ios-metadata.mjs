#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createFailureCollector, validatePngDirectory } from "./store-screenshot-validation.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const mobileRoot = join(repoRoot, "apps", "mobile");
const metadataDir = join(mobileRoot, "fastlane", "metadata", "en-US");
const screenshotRedesignPending = existsSync(
  join(mobileRoot, "store-assets", "SCREENSHOTS_PENDING_REDESIGN.md"),
);
const screenshotDir = join(metadataDir, "screenshots");
const iosScreenshotWidth = 1320;
const iosScreenshotHeight = 2868;
const iosScreenshotCount = 7;

const read = (relativePath) =>
  readFileSync(join(metadataDir, relativePath), "utf8").trim();

const { assert, failures } = createFailureCollector();

const assertLength = (label, value, max) => {
  assert(value.length > 0, `${label} must not be empty`);
  assert(value.length <= max, `${label} must be <= ${max} chars; got ${value.length}`);
};

const name = read("name.txt");
const subtitle = read("subtitle.txt");
const promotionalText = read("promotional_text.txt");
const keywords = read("keywords.txt");
const description = read("description.txt");
const releaseNotes = read("release_notes.txt");
const supportUrl = read("support_url.txt");
const privacyUrl = read("privacy_url.txt");
const marketingUrl = read("marketing_url.txt");
const reviewNotes = read(join("review_information", "notes.txt"));

assertLength("App Store name", name, 30);
assertLength("App Store subtitle", subtitle, 30);
assertLength("App Store promotional text", promotionalText, 170);
assertLength("App Store keywords", keywords, 100);
assertLength("App Store description", description, 4000);
assertLength("App Store release notes", releaseNotes, 4000);

for (const [label, value] of [
  ["support_url.txt", supportUrl],
  ["privacy_url.txt", privacyUrl],
  ["marketing_url.txt", marketingUrl],
]) {
  assert(value.startsWith("https://"), `${label} must start with https://`);
}

const combinedStoreCopy = [
  description,
  releaseNotes,
  reviewNotes,
  promotionalText,
  subtitle,
].join("\n");

assert(
  !/\btap Start\b/i.test(combinedStoreCopy),
  "Store-facing iOS metadata must say tap Listen, not tap Start",
);
assert(
  /\btap Listen\b/i.test(reviewNotes),
  "Review notes must include the real first-session CTA: tap Listen",
);
assert(
  /no account/i.test(reviewNotes),
  "Review notes must state that no account is required",
);

if (!screenshotRedesignPending) {
  const screenshotValidation = validatePngDirectory({
    directory: screenshotDir,
    expectedCount: iosScreenshotCount,
    expectedHeight: iosScreenshotHeight,
    expectedWidth: iosScreenshotWidth,
    directoryLabel: "en-US App Store screenshots",
    label: "en-US",
    requireDirectory: true,
    requireOpaque: true,
    screenshotLabel: "App Store screenshots",
  });
  failures.push(...screenshotValidation.failures);
} else {
  console.log("iOS screenshot validation skipped while the screenshot redesign is pending.");
}

if (failures.length > 0) {
  console.error("iOS metadata validation failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("iOS metadata validation passed.");
