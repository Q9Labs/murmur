#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const mobileRoot = resolve(repoRoot, "apps/mobile");
const appConfig = JSON.parse(readFileSync(resolve(mobileRoot, "app.json"), "utf8")).expo;
const platform = process.env.EAS_BUILD_PLATFORM;

if (platform !== "android" && platform !== "ios") {
  fail("EAS_BUILD_PLATFORM must be android or ios.");
}
if (!process.env.SENTRY_AUTH_TOKEN) {
  fail("SENTRY_AUTH_TOKEN is required to link the mobile Sentry release.");
}

const release = getMobileRelease(appConfig, platform);
const environment = getBuildEnvironment(process.env.EAS_BUILD_PROFILE);
const sentryEnvironment = {
  ...process.env,
  SENTRY_ORG: process.env.SENTRY_ORG ?? "q9labs",
  SENTRY_PROJECT: process.env.SENTRY_PROJECT ?? "murmur-mobile",
};

ensureRelease(release);
runSentry(["releases", "set-commits", release, "--auto", "--ignore-missing"]);
runSentry(["releases", "finalize", release]);
runSentry(["releases", "deploys", release, "new", "--env", environment]);
console.log(`Linked Sentry release ${release} to commits and ${environment}.`);

function getMobileRelease(config, targetPlatform) {
  if (targetPlatform === "android") {
    return `${config.android.package}@${config.version}+${config.android.versionCode}`;
  }
  return `${config.ios.bundleIdentifier}@${config.version}+${config.ios.buildNumber}`;
}

function getBuildEnvironment(profile) {
  if (profile === "development" || profile === "preview") {
    return profile;
  }
  return "production";
}

function ensureRelease(releaseName) {
  const exists = spawnSync("sentry-cli", ["releases", "info", releaseName], {
    cwd: mobileRoot,
    env: sentryEnvironment,
    stdio: "ignore",
  });
  if (exists.status === 0) {
    return;
  }
  runSentry(["releases", "new", releaseName]);
}

function runSentry(args) {
  const result = spawnSync("sentry-cli", args, {
    cwd: mobileRoot,
    env: sentryEnvironment,
    stdio: "inherit",
  });
  if (result.status !== 0) {
    fail(`sentry-cli ${args[0]} failed with exit code ${result.status ?? "unknown"}.`);
  }
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
