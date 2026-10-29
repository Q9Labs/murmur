import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { assertSafeMerge, isLocallyFixedDeepmerge, patchHash, sha256, verifyDeepmergePatch } from "./deepmerge-patch.mjs";

const require = createRequire(import.meta.url);

test("the installed patch rejects the upstream exploit across source and target paths", (t) => {
  const directories = verifyDeepmergePatch();
  const directory = directories[0];
  const fixed = require(path.join(directory, "dist/cjs.js"));
  assertSafeMerge(fixed);
  const tmp = mkdtempSync(path.join(tmpdir(), "deepmerge-regression-"));
  t.after(() => rmSync(tmp, { recursive: true, force: true }));
  const source = readFileSync(path.join(directory, "dist/cjs.js"), "utf8");
  const upstream = source.replace(".filter(function(key) { return key !== '__proto__' })", "");
  assert.equal(sha256(upstream), "2e5160f84a1141bd927264afe4d15766f1e6cf07daef182b37ff53fea121de7d");
  const fixture = path.join(tmp, "upstream.cjs");
  writeFileSync(fixture, upstream);
  const vulnerable = require(fixture);
  const poisoned = vulnerable({ session: null }, JSON.parse('{"session":{"__proto__":{"admin":true}}}'));
  assert.equal(poisoned.session.admin, true);
  assert.equal(Object.hasOwn(poisoned.session, "admin"), false);
  assert.throws(() => assertSafeMerge(vulnerable), /prototype poisoning/);
});

test("normal config merging preserves upstream arrays, callbacks, symbols and cloning", () => {
  const [directory] = verifyDeepmergePatch();
  const merge = require(path.join(directory, "dist/cjs.js"));
  const left = { list: [{ a: 1 }], nested: { a: 1 } };
  const right = { list: [{ b: 2 }], nested: { b: 2 } };
  assert.deepEqual(merge(left, right), { list: [{ a: 1 }, { b: 2 }], nested: { a: 1, b: 2 } });
  assert.notEqual(merge(left, right).list[0], left.list[0]);
  assert.equal(merge({}, left, { clone: false }).nested, left.nested);
  assert.deepEqual(merge(left, right, { arrayMerge: (_target, source) => source }).list, right.list);
  assert.deepEqual(merge.all([left, right]).nested, { a: 1, b: 2 });
  assert.deepEqual(merge(left, right, { customMerge: (key) => key === "nested" ? (_target, source) => source : undefined }).nested, { b: 2 });
  const key = Symbol("config");
  assert.equal(merge({}, { [key]: 42 })[key], 42);
  const date = new Date(0);
  assert.equal(merge({}, { date }).date, date);
  const pattern = /config/;
  assert.equal(merge({}, { pattern }).pattern, pattern);
});

test("Expo's actual config modification boundary cannot return poisoned extra/plugin options", async (t) => {
  const mobile = createRequire(path.resolve("apps/mobile/package.json"));
  const expo = createRequire(mobile.resolve("expo/package.json"));
  const { modifyConfigAsync } = expo("@expo/config");
  const tmp = mkdtempSync(path.join(tmpdir(), "expo-merge-regression-"));
  t.after(() => rmSync(tmp, { recursive: true, force: true }));
  writeFileSync(path.join(tmp, "package.json"), '{"name":"config-fixture","version":"1.0.0"}');
  writeFileSync(path.join(tmp, "app.json"), JSON.stringify({ expo: { name: "Fixture", slug: "fixture", extra: { session: null }, plugins: [["fixture-plugin", { session: null }]] } }));
  const modifications = JSON.parse('{"extra":{"session":{"__proto__":{"admin":true}},"normal":42},"plugins":[["fixture-plugin",{"session":{"__proto__":{"admin":true}},"normal":42}]]}');
  const result = await modifyConfigAsync(tmp, modifications, { skipPlugins: true, skipSDKVersionRequirement: true }, { dryRun: true });
  assert.equal(result.type, "success");
  assert.equal(result.config.extra.session.admin, undefined);
  assert.equal(result.config.extra.normal, 42);
  assert.equal(result.config.plugins[0][1].session.admin, undefined);
  assert.equal(result.config.plugins[0][1].normal, 42);
});

test("scanner treatment is advisory/version/source-specific and fails if the patch pin disappears", (t) => {
  const finding = { id: "GHSA-gcqx-w48m-w2h4", package: "deepmerge", version: "4.3.1", ecosystem: "npm", source: "pnpm-lock.yaml" };
  assert.equal(isLocallyFixedDeepmerge(finding), true);
  for (const change of [{ id: "NEW-ADVISORY" }, { version: "4.3.0" }, { source: "nested/pnpm-lock.yaml" }, { package: "other" }]) {
    assert.equal(isLocallyFixedDeepmerge({ ...finding, ...change }), false);
  }
  const tmp = mkdtempSync(path.join(tmpdir(), "deepmerge-pin-regression-"));
  t.after(() => rmSync(tmp, { recursive: true, force: true }));
  mkdirSync(path.join(tmp, "patches"));
  writeFileSync(path.join(tmp, "patches/deepmerge@4.3.1.patch"), readFileSync("patches/deepmerge@4.3.1.patch"));
  writeFileSync(path.join(tmp, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n");
  assert.throws(() => verifyDeepmergePatch(tmp), /lockfile must pin/);
  writeFileSync(path.join(tmp, "pnpm-lock.yaml"), `patchedDependencies:\n  deepmerge@4.3.1: ${patchHash}\nsnapshots:\n  parent:\n    dependencies:\n      deepmerge: 4.3.1\n`);
  assert.throws(() => verifyDeepmergePatch(tmp), /unpatched deepmerge remains/);
  writeFileSync(path.join(tmp, "patches/deepmerge@4.3.1.patch"), "changed");
  assert.throws(() => verifyDeepmergePatch(tmp), /patch changed/);
});
