import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, realpathSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

export const patchHash = "1f44ebfc1588cf9f19d38ff2ea5f6cf13f4da3b40e592996d801c030dd8e3040";
const fileHashes = {
  "index.js": "2d5422e0a11bab218fc2937a2946dbecfd5347e1341ea2798e627024eaad6992",
  "dist/cjs.js": "d970fd878ebf7c9c2def4fad2157f6a2a95c75c6d2c74163cb3ed301e3980d38",
  "dist/umd.js": "498d4eac24dd4ee5fd6f676a4c060a7890f68d9700c23e9c13dbdc529bc0e6b7",
};
const require = createRequire(import.meta.url);
export const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

export function assertSafeMerge(merge) {
  const payload = JSON.parse('{"session":{"__proto__":{"admin":true}}}');
  for (const session of [null, 0, {}]) {
    const result = merge({ session }, payload);
    assert.equal(result.session.admin, undefined, "nested prototype poisoning");
    assert.equal(Object.getPrototypeOf(result.session), Object.prototype);
  }
  const rootPayload = JSON.parse('{"__proto__":{"admin":true},"safe":1}');
  for (const target of [Object.create(null), rootPayload]) {
    const result = merge(target, rootPayload);
    assert.equal(result.admin, undefined, "target/source prototype poisoning");
    assert.equal(Object.hasOwn(result, "__proto__"), false);
    assert.equal(result.safe, 1);
  }
  assert.equal({}.admin, undefined);
}

// OSV sees upstream 4.3.1, not pnpm's patched bytes. Attest only the exact local
// fix, and verify every installed dependency path before treating its advisory as fixed.
export function verifyDeepmergePatch(root = process.cwd()) {
  assert.equal(sha256(readFileSync(path.join(root, "patches/deepmerge@4.3.1.patch"))), patchHash, "deepmerge patch changed; re-review the fix");
  const lock = readFileSync(path.join(root, "pnpm-lock.yaml"), "utf8");
  assert.ok(lock.includes(`  deepmerge@4.3.1: ${patchHash}\n`), "lockfile must pin the reviewed patch");
  const refs = [...lock.matchAll(/^\s+deepmerge: (.+)$/gm)].map((match) => match[1]);
  assert.ok(refs.length > 0, "deepmerge dependency inventory is empty");
  assert.ok(refs.every((ref) => ref === `4.3.1(patch_hash=${patchHash})`), "unpatched deepmerge remains in the lockfile");
  const listed = spawnSync("pnpm", ["list", "deepmerge", "--depth", "Infinity", "--recursive", "--json"], { cwd: root, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
  assert.equal(listed.status, 0, listed.stderr || "cannot inspect installed deepmerge dependencies");
  const directories = new Set();
  function visit(node) {
    for (const field of ["dependencies", "devDependencies", "optionalDependencies"]) {
      for (const [name, dependency] of Object.entries(node[field] ?? {})) {
        if (name === "deepmerge") directories.add(realpathSync(dependency.path));
        visit(dependency);
      }
    }
  }
  const projects = JSON.parse(listed.stdout);
  assert.ok(Array.isArray(projects), "invalid installed dependency inventory");
  projects.forEach(visit);
  assert.ok(directories.size > 0, "installed deepmerge dependency inventory is empty");
  for (const directory of directories) {
    assert.equal(JSON.parse(readFileSync(path.join(directory, "package.json"), "utf8")).version, "4.3.1");
    for (const [file, hash] of Object.entries(fileHashes)) {
      assert.equal(sha256(readFileSync(path.join(directory, file))), hash, `unreviewed/unpatched deepmerge: ${file}`);
    }
    for (const file of ["dist/cjs.js", "dist/umd.js"]) assertSafeMerge(require(path.join(directory, file)));
  }
  return [...directories];
}

export function isLocallyFixedDeepmerge(finding) {
  return finding.id === "GHSA-gcqx-w48m-w2h4" && finding.package === "deepmerge" &&
    finding.version === "4.3.1" && finding.ecosystem === "npm" && finding.source === "pnpm-lock.yaml";
}
