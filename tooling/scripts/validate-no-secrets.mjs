#!/usr/bin/env node

import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const ignoredDirectories = new Set([
  ".expo",
  ".git",
  ".worktrees",
  ".gradle",
  ".next",
  ".turbo",
  ".wrangler",
  "android",
  "dist",
  "ios",
  "node_modules",
  "web-build",
]);
const ignoredExtensions = new Set([
  ".aab",
  ".apk",
  ".gif",
  ".ico",
  ".jpg",
  ".jpeg",
  ".jks",
  ".keystore",
  ".mobileprovision",
  ".p12",
  ".p8",
  ".png",
  ".ttf",
  ".webp",
]);
const ignoredFiles = new Set(["pnpm-lock.yaml"]);
const failures = [];

const patterns = [
  {
    description: "OpenAI API key",
    pattern: /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/g,
    allow: (match) => match.includes("server-side-only"),
  },
  {
    description: "inline Android keystore password",
    pattern: /\bMURMUR_ANDROID_(?:KEYSTORE|KEY)_PASSWORD\s*=\s*["']?[A-Za-z0-9+/=_-]{20,}/g,
    allow: (match) => match.includes("replace-with-"),
  },
  {
    description: "private key block",
    pattern: /-----BEGIN (?:RSA |EC |OPENSSH |)?PRIVATE KEY-----/g,
    allow: (_match, relativePath, contents) =>
      relativePath === "apps/mobile/.env.example" ||
      relativePath === "apps/worker/.dev.vars.example" ||
      relativePath === "tooling/scripts/validate-no-secrets.mjs" ||
      contents.includes('.replace("-----BEGIN PRIVATE KEY-----"'),
  },
  {
    description: "Google service account private key",
    pattern: /"private_key"\s*:\s*"-----BEGIN PRIVATE KEY-----/g,
    allow: (_match, relativePath) => relativePath === "tooling/scripts/validate-no-secrets.mjs",
  },
];

const isIgnored = (relativePath, isDirectory) => {
  const parts = relativePath.split("/");
  if (parts.some((part) => ignoredDirectories.has(part))) {
    return true;
  }
  if (isDirectory) {
    return false;
  }
  if (ignoredFiles.has(relativePath)) {
    return true;
  }

  const extension = relativePath.match(/\.[^.]+$/)?.[0] ?? "";
  return ignoredExtensions.has(extension);
};

const scanFile = (filePath) => {
  const relativePath = relative(root, filePath);
  let contents = "";
  try {
    contents = readFileSync(filePath, "utf8");
  } catch {
    return;
  }

  for (const { allow, description, pattern } of patterns) {
    pattern.lastIndex = 0;
    for (const match of contents.matchAll(pattern)) {
      if (allow?.(match[0], relativePath, contents)) {
        continue;
      }
      failures.push(`${relativePath}: matched ${description}`);
    }
  }
};

const walk = (directory) => {
  for (const entry of readdirSync(directory)) {
    const filePath = join(directory, entry);
    const relativePath = relative(root, filePath);
    const stats = statSync(filePath);
    if (isIgnored(relativePath, stats.isDirectory())) {
      continue;
    }
    if (stats.isDirectory()) {
      walk(filePath);
    } else if (stats.isFile()) {
      scanFile(filePath);
    }
  }
};

walk(root);

if (failures.length > 0) {
  console.error("Secret validation failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Secret validation passed.");
