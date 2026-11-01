import assert from "node:assert/strict";
import { readdirSync, readFileSync, realpathSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { test } from "node:test";

// Major-version dependency overrides only keep their promise if every real
// transitive consumer still works. This gate exercises the resolved graph the
// way consumers actually call it, so a broken override fails here, not in a
// downstream tool invocation.
const repoRoot = path.resolve(import.meta.dirname, "..", "..");
const require = createRequire(path.join(repoRoot, "package.json"));

function requireFrom(packageJsonPath) {
  // pnpm links workspace node_modules entries to .pnpm; module resolution must
  // run from the real package directory, mirroring how Node loads the consumer.
  return createRequire(realpathSync(packageJsonPath));
}

function pnpmPackageJson(name) {
  const store = path.join(repoRoot, "node_modules", ".pnpm");
  const prefix = name.startsWith("@") ? name.replace("/", "+") + "@" : name + "@";
  const match = readdirSync(store).find((entry) => entry.startsWith(prefix));
  assert.ok(match, `${name} must be installed under node_modules/.pnpm`);
  return path.join(store, match, "node_modules", name, "package.json");
}

test("test-exclude resolves fixed minimatch/glob through the babel-plugin-istanbul coverage path", () => {
  // babel-plugin-istanbul -> test-exclude is the coverage instrumentation path.
  // test-exclude calls { minimatch }(path, pattern) and { glob }.sync(patterns).
  const istanbul = requireFrom(pnpmPackageJson("babel-plugin-istanbul"));
  const TestExclude = istanbul("test-exclude");
  const resolvedMinimatch = istanbul.resolve("test-exclude");
  const testExcludeReq = requireFrom(resolvedMinimatch);
  const minimatch = testExcludeReq("minimatch");
  assert.equal(typeof minimatch.minimatch, "function");
  assert.equal(minimatch.minimatch("apps/mobile/src/a.ts", "apps/**", { dot: true }), true);
  const exclude = new TestExclude({ cwd: repoRoot, extension: [".ts"], exclude: ["**/*.test.ts"] });
  assert.equal(exclude.shouldInstrument(path.join(repoRoot, "apps/mobile/src/foo.ts")), true);
  assert.equal(exclude.shouldInstrument(path.join(repoRoot, "apps/mobile/src/foo.test.ts")), false);
  const { glob } = testExcludeReq("glob");
  assert.ok(Array.isArray(glob.sync("apps/mobile/src/*.ts", { cwd: repoRoot, nodir: true })));
});

test("@expo/fingerprint path ignore matching works under the resolved Minimatch class", () => {
  // @expo/fingerprint builds `new Minimatch(pattern, options)` objects for
  // fingerprint ignore paths; it must not hit a stubbed or legacy class.
  const fingerprint = requireFrom(pnpmPackageJson("@expo/fingerprint"));
  const { isIgnoredPath } = fingerprint("./build/utils/Path.js");
  assert.equal(isIgnoredPath("apps/mobile/node_modules/x/index.js", ["**/node_modules/**"]), true);
  assert.equal(isIgnoredPath("apps/mobile/src/app.ts", ["**/node_modules/**"]), false);
});

test("glob 7 / minimatch 3 cannot silently return to the resolved graph", () => {
  // glob 7 reads minimatch 3 private internals (Minimatch._glob, globSet, set),
  // so a forced major minimatch makes the pair crash at glob/sync.js. The fix
  // removes them from the resolution entirely; this guards the invariant.
  const lockfile = readFileSync(path.join(repoRoot, "pnpm-lock.yaml"), "utf8");
  assert.doesNotMatch(lockfile, /\bglob@7\./, "glob@7.x must not be resolved");
  assert.doesNotMatch(lockfile, /\bminimatch@[0-8]\./, "minimatch < 9 must not be resolved");
  const overrides = readFileSync(path.join(repoRoot, "pnpm-workspace.yaml"), "utf8");
  assert.doesNotMatch(overrides, /glob@7\.2\.3>minimatch/, "the unsafe glob7>minimatch override stays removed");
});
