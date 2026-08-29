#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const workerRoot = resolve(repoRoot, "apps/worker");
const environment = process.argv[2];

if (environment !== "development" && environment !== "production") {
  fail("Usage: deploy-worker-release.mjs <development|production>");
}
if (!process.env.SENTRY_AUTH_TOKEN) {
  fail("SENTRY_AUTH_TOKEN is required before a Worker release deployment.");
}
if (environment === "production") {
  const dirtyWorktree = capture(
    "git",
    ["status", "--porcelain", "--untracked-files=all"],
    repoRoot,
  ).trim();
  if (dirtyWorktree) {
    fail("Production Worker releases require a clean worktree so the deployed revision is exact.");
  }
}

const workerPackage = JSON.parse(readFileSync(resolve(workerRoot, "package.json"), "utf8"));
const revision = capture("git", ["rev-parse", "HEAD"], repoRoot).trim();
const release = `murmur-worker@${workerPackage.version}+${revision.slice(0, 12)}`;
const bundleDirectory = mkdtempSync(join(tmpdir(), "murmur-worker-sourcemaps-"));
const sentryEnvironment = {
  ...process.env,
  SENTRY_ORG: process.env.SENTRY_ORG ?? "q9labs",
  SENTRY_PROJECT: process.env.SENTRY_PROJECT ?? "murmur-worker",
};

try {
  run(
    "pnpm",
    [
      "--filter",
      "@murmur/worker",
      "exec",
      "wrangler",
      "deploy",
      "--config",
      "wrangler.toml",
      "--env",
      environment,
      "--outdir",
      bundleDirectory,
      "--upload-source-maps",
      "--keep-vars",
      "--var",
      `SENTRY_RELEASE:${release}`,
    ],
    repoRoot,
    process.env,
  );

  if (!containsSourceMap(bundleDirectory)) {
    fail(`Wrangler did not write a source map to ${bundleDirectory}.`);
  }

  ensureRelease(release);
  runSentry([
    "sourcemaps",
    "upload",
    "--release",
    release,
    "--url-prefix",
    "~/",
    "--validate",
    "--strict",
    bundleDirectory,
  ]);
  runSentry(["releases", "set-commits", release, "--auto", "--ignore-missing"]);
  runSentry(["releases", "finalize", release]);
  runSentry(["releases", "deploys", release, "new", "--env", environment]);
  console.log(`Deployed Worker and linked Sentry release ${release} to ${environment}.`);
} finally {
  rmSync(bundleDirectory, { force: true, recursive: true });
}

function containsSourceMap(directory) {
  return readdirSync(directory, { recursive: true }).some((entry) => String(entry).endsWith(".map"));
}

function ensureRelease(releaseName) {
  const exists = spawnSync("sentry-cli", ["releases", "info", releaseName], {
    cwd: workerRoot,
    env: sentryEnvironment,
    stdio: "ignore",
  });
  if (exists.status === 0) {
    return;
  }
  runSentry(["releases", "new", releaseName]);
}

function runSentry(args) {
  run("sentry-cli", args, workerRoot, sentryEnvironment);
}

function run(command, args, cwd, env) {
  const result = spawnSync(command, args, { cwd, env, stdio: "inherit" });
  if (result.status !== 0) {
    fail(`${command} ${args[0]} failed with exit code ${result.status ?? "unknown"}.`);
  }
}

function capture(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, encoding: "utf8" });
  if (result.status !== 0) {
    fail(result.stderr.trim() || `${command} ${args[0]} failed.`);
  }
  return result.stdout;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
