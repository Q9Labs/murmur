import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
const require = createRequire(import.meta.url);
const { resolveWorkerTarget } = require("../../apps/mobile/workerTarget.js");
const updateScript = fileURLToPath(new URL("./update-mobile.mjs", import.meta.url));
const profiles = require("../../apps/mobile/eas.json").build;

test("every existing build profile keeps its backend and embedded channel coherent", () => {
  for (const [name, profile] of Object.entries(profiles)) {
    assert.equal(resolveWorkerTarget({ workerUrl: profile.env.EXPO_PUBLIC_MURMUR_WORKER_URL, environment: profile.env.EXPO_PUBLIC_MURMUR_ENV, channel: name, nodeEnv: "production" }), profile.env.EXPO_PUBLIC_MURMUR_WORKER_URL);
    const update = spawnSync(process.execPath, [updateScript, name, "fixture", "--dry-run"], { encoding: "utf8" });
    assert.equal(update.status, 0, update.stderr);
    const result = JSON.parse(update.stdout);
    assert.equal(result.command[result.command.indexOf("--channel") + 1], name);
    assert.equal(result.command[result.command.indexOf("--environment") + 1], profile.environment);
    assert.equal(result.workerUrl, profile.env.EXPO_PUBLIC_MURMUR_WORKER_URL);
  }
});

test("missing, unknown and ambiguous update targets cannot start EAS", () => {
  for (const args of [[], ["staging", "fixture"], ["preview"], ["preview", "fixture", "--channel", "production"]]) {
    const result = spawnSync(process.execPath, [updateScript, ...args], { encoding: "utf8", env: { ...process.env, PATH: "" } });
    assert.equal(result.status, 2, result.stderr);
    assert.equal(result.stdout, "");
  }
});

test("installed nonproduction channels reject production-labelled or production-backed OTA bundles", () => {
  for (const channel of ["development", "preview", "testing", "sandbox"]) {
    assert.throws(() => resolveWorkerTarget({ channel, nodeEnv: "production" }), /explicit/);
    assert.throws(() => resolveWorkerTarget({ channel, environment: "production", workerUrl: profiles.production.env.EXPO_PUBLIC_MURMUR_WORKER_URL }), /explicit|does not match/);
    const environment = profiles[channel].env.EXPO_PUBLIC_MURMUR_ENV;
    for (const workerUrl of [profiles.production.env.EXPO_PUBLIC_MURMUR_WORKER_URL, "https://murmur-worker-development.msbilal.workers.dev"]) {
      assert.throws(() => resolveWorkerTarget({ channel, environment, workerUrl }), /does not match/);
    }
  }
  assert.throws(() => resolveWorkerTarget({ nodeEnv: "production" }), /known Murmur/);
});

test("native development clients cannot select production regardless of JS mode or channel", () => {
  for (const nodeEnv of ["development", "production"]) {
    for (const channel of [null, undefined, "", "production"]) {
      const input = { channel, nodeEnv, environment: "production", workerUrl: profiles.production.env.EXPO_PUBLIC_MURMUR_WORKER_URL };
      assert.throws(() => resolveWorkerTarget({ ...input, isDevelopmentClient: true }), /development clients cannot select/);
      assert.equal(resolveWorkerTarget({ ...input, isDevelopmentClient: false }), profiles.production.env.EXPO_PUBLIC_MURMUR_WORKER_URL);
    }
  }
});

test("native development clients retain explicit nonproduction bundles and installed OTA channels", () => {
  for (const name of ["development", "preview", "testing", "sandbox"]) {
    const profile = profiles[name];
    for (const channel of [null, name]) {
      assert.equal(resolveWorkerTarget({ channel, nodeEnv: "production", environment: profile.env.EXPO_PUBLIC_MURMUR_ENV, workerUrl: profile.env.EXPO_PUBLIC_MURMUR_WORKER_URL, isDevelopmentClient: true }), profile.env.EXPO_PUBLIC_MURMUR_WORKER_URL);
    }
  }
});

test("only local development accepts an unlabeled explicit loopback URL", () => {
  for (const workerUrl of ["http://localhost:8787", "http://127.0.0.1:8787", "http://[::1]:8787"]) {
    assert.equal(resolveWorkerTarget({ workerUrl, nodeEnv: "development", channel: null }), workerUrl);
    assert.throws(() => resolveWorkerTarget({ workerUrl, nodeEnv: "production", channel: null, isDevelopmentClient: true }), /known Murmur/);
    assert.throws(() => resolveWorkerTarget({ workerUrl, nodeEnv: "development", channel: "preview", environment: "preview" }), /does not match/);
  }
  for (const workerUrl of ["https://murmur.q9labs.ai", "http://localhost.evil.test:8787", "http://192.0.2.1:8787", "https://localhost:8787"]) {
    assert.throws(() => resolveWorkerTarget({ workerUrl, nodeEnv: "development", channel: null }), /known Murmur/);
  }
});

test("development identity never relaxes missing, unknown or conflicting target validation", () => {
  assert.throws(() => resolveWorkerTarget({ nodeEnv: "production", channel: null, isDevelopmentClient: true }), /known Murmur/);
  assert.throws(() => resolveWorkerTarget({ nodeEnv: "production", channel: "unrecognized", isDevelopmentClient: true }), /known Murmur/);
  assert.throws(() => resolveWorkerTarget({ channel: "preview", environment: "production", workerUrl: profiles.production.env.EXPO_PUBLIC_MURMUR_WORKER_URL, isDevelopmentClient: true }), /explicit environment/);
  assert.throws(() => resolveWorkerTarget({ channel: null, environment: "preview", workerUrl: profiles.production.env.EXPO_PUBLIC_MURMUR_WORKER_URL, isDevelopmentClient: true }), /does not match/);
});

test("app configuration rejects missing/mismatched release targets but preserves explicit production builds", () => {
  const config = fileURLToPath(new URL("../../apps/mobile/app.config.js", import.meta.url));
  const evaluate = (variables) => spawnSync(process.execPath, ["-e", "require(process.argv[1])", config], { encoding: "utf8", env: { PATH: process.env.PATH, NODE_ENV: "production", ...variables } });
  assert.notEqual(evaluate({}).status, 0);
  for (const [name, profile] of Object.entries(profiles)) {
    assert.equal(evaluate({ ...profile.env, EAS_BUILD_PROFILE: name }).status, 0);
    assert.equal(evaluate({ ...profile.env, MURMUR_UPDATES_CHANNEL: name }).status, 0);
    if (name !== "production") {
      assert.notEqual(evaluate({ ...profiles.production.env, EAS_BUILD_PROFILE: name }).status, 0);
    }
  }
  assert.notEqual(evaluate({ ...profiles.production.env, EAS_BUILD_PROFILE: "preview", MURMUR_UPDATES_CHANNEL: "production" }).status, 0);
});
