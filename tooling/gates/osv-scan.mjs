import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { isLocallyFixedDeepmerge, patchHash, verifyDeepmergePatch } from "./deepmerge-patch.mjs";

const scan = spawnSync("osv-scanner", ["scan", "source", "-r", "--experimental-exclude", "scratchpad", "--experimental-exclude", ".worktrees", "--all-packages", "--format", "json", "."], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
assert.ok(scan.status === 0 || scan.status === 1, scan.stderr || "OSV scan failed to run");
const report = JSON.parse(scan.stdout);
const unresolved = [];
let fixed = 0;
let rootPackages = 0;
for (const result of report.results ?? []) {
  const source = path.relative(process.cwd(), path.resolve(result.source.path)).replaceAll("\\", "/");
  if (source === "pnpm-lock.yaml") rootPackages += result.packages.length;
  for (const entry of result.packages ?? []) {
    for (const vulnerability of entry.vulnerabilities ?? []) {
      const finding = { id: vulnerability.id, package: entry.package.name, version: entry.package.version, ecosystem: entry.package.ecosystem, source };
      if (isLocallyFixedDeepmerge(finding)) fixed += 1;
      else unresolved.push(finding);
    }
  }
}
assert.ok(rootPackages >= 1000, `OSV root inventory collapsed: ${rootPackages} packages; use OSV 2.6.0 or later for the two-document pnpm lockfile`);
if (fixed > 0) {
  verifyDeepmergePatch();
  console.log(`OSV local fix verified: GHSA-gcqx-w48m-w2h4 deepmerge@4.3.1, patch SHA-256 ${patchHash}.`);
}
assert.ok(scan.status === 0 || unresolved.length + fixed > 0, "OSV exited nonzero without reported findings");
console.log(`OSV root inventory: ${rootPackages} packages; verified local fixes: ${fixed}; unresolved records: ${unresolved.length}.`);
for (const finding of unresolved) console.error(JSON.stringify(finding));
if (unresolved.length > 0) process.exit(1);
