#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { findOpenSubmissionBlockers, validateSubmissionBlockerLedger } from "./submission-blockers.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const blockerPath = join(repoRoot, "docs", "submission-blockers.json");
const payload = JSON.parse(readFileSync(blockerPath, "utf8"));
const argumentsList = process.argv.slice(2);
const unsupportedArguments = argumentsList.filter((argument) => argument !== "--require-closed");
const requireClosed = argumentsList.includes("--require-closed");

if (unsupportedArguments.length > 0) {
  console.error(`Unsupported argument(s): ${unsupportedArguments.join(", ")}`);
  process.exit(1);
}

const failures = validateSubmissionBlockerLedger(payload);

if (failures.length > 0) {
  console.error("Submission blocker ledger validation failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

const openBlockers = findOpenSubmissionBlockers(payload);
if (openBlockers.length > 0) {
  const report = `Murmur is not submission-ready: ${openBlockers.length} open P0 blocker(s).`;
  if (requireClosed) console.error(report);
  else console.log(report);
  for (const blocker of openBlockers) {
    const blockerLine = `- ${blocker.id}: ${blocker.title} [${blocker.status}]`;
    if (requireClosed) console.error(blockerLine);
    else console.log(blockerLine);
  }
  if (requireClosed) process.exit(1);
} else {
  console.log("Submission blocker ledger has no open P0 blockers.");
}
