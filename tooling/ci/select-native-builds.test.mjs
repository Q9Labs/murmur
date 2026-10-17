import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

function select(paths) {
  const result = spawnSync(process.execPath, [new URL("select-native-builds.mjs", import.meta.url).pathname], {
    input: paths.join("\0"),
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

test("worker-only, documentation, and empty changes do not rebuild native apps", () => {
  for (const paths of [[], ["apps/worker/src/index.ts"], ["docs/guide.md", "README.md"]]) {
    assert.equal(select(paths), "native=false");
  }
});

test("app, shared, dependency, plugin, and CI changes rebuild native apps", () => {
  for (const file of [
    "apps/mobile/app/index.tsx",
    "apps/mobile/plugins/with-audio.mjs",
    "apps/mobile/modules/murmur-audio/android/Service.kt",
    "packages/protocol/src/index.ts",
    "package.json",
    "pnpm-lock.yaml",
    "pnpm-workspace.yaml",
    "patches/expo.patch",
    "tsconfig.base.json",
    ".npmrc",
    ".github/workflows/ci.yml",
    "tooling/ci/select-native-builds.mjs",
  ]) {
    assert.equal(select(["docs/guide.md", file]), "native=true", file);
  }
});

test("NUL-delimited paths preserve filenames containing newlines", () => {
  assert.equal(select(["docs/guide\napps/mobile/not-a-real-path.md"]), "native=false");
});
