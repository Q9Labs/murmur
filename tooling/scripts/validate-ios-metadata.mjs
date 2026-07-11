#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const mobileRoot = join(repoRoot, "apps", "mobile");
const metadataDir = join(mobileRoot, "fastlane", "metadata", "en-US");

const read = (relativePath) =>
  readFileSync(join(metadataDir, relativePath), "utf8").trim();

const failures = [];

const assert = (condition, message) => {
  if (!condition) {
    failures.push(message);
  }
};

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

if (failures.length > 0) {
  console.error("iOS metadata validation failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("iOS metadata validation passed.");
