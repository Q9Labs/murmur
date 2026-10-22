#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createFailureCollector, iosScreenshotSpec, validatePngDirectory } from "./store-screenshot-validation.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const mobileRoot = join(repoRoot, "apps", "mobile");
const metadataRoot = join(mobileRoot, "fastlane", "metadata");
const metadataDir = join(metadataRoot, "en-US");
const screenshotRedesignPending = existsSync(
  join(mobileRoot, "store-assets", "SCREENSHOTS_PENDING_REDESIGN.md"),
);
const screenshotDir = join(metadataDir, "screenshots");

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

for (const locale of readdirSync(metadataRoot, { withFileTypes: true })) {
  if (!locale.isDirectory() || locale.name === "android") continue;
  for (const [file, max] of [
    ["name.txt", 30],
    ["subtitle.txt", 30],
    ["promotional_text.txt", 170],
    ["keywords.txt", 100],
    ["description.txt", 4000],
    ["release_notes.txt", 4000],
  ]) {
    const value = readFileSync(join(metadataRoot, locale.name, file), "utf8").trim();
    if (file === "keywords.txt") {
      const bytes = Buffer.byteLength(value, "utf8");
      assert(bytes > 0 && bytes <= max, `${locale.name}/${file} must be 1-${max} bytes; got ${bytes}`);
    } else {
      assertLength(`${locale.name}/${file}`, value, max);
    }
  }
}
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
  /guest account/i.test(reviewNotes),
  "Review notes must explain the automatic guest account",
);
assert(
  /may include Free minutes depending on the current offer/i.test(reviewNotes)
    && /buy Trip Pass with an Apple sandbox account/i.test(reviewNotes),
  "Review notes must cover both the current offer and the no-time sandbox purchase path",
);
assert(
  /server-side/i.test(reviewNotes),
  "Review notes must explain server-side purchase verification",
);

if (!screenshotRedesignPending) {
  const screenshotValidation = validatePngDirectory({
    directory: screenshotDir,
    expectedCount: iosScreenshotSpec.count,
    expectedHeight: iosScreenshotSpec.height,
    expectedWidth: iosScreenshotSpec.width,
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
