#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const blockerPath = join(root, "docs", "submission-blockers.json");
const payload = JSON.parse(readFileSync(blockerPath, "utf8"));
const failures = [];

const assert = (condition, message) => {
  if (!condition) {
    failures.push(message);
  }
};

assert(payload.status === "not_submission_ready" || payload.status === "submission_ready", "status must be explicit");
assert(Array.isArray(payload.policy_sources_checked), "policy_sources_checked must be an array");
assert((payload.policy_sources_checked ?? []).length >= 4, "policy_sources_checked should include Apple and Google sources");
assert(Array.isArray(payload.p0_blockers), "p0_blockers must be an array");

for (const blocker of payload.p0_blockers ?? []) {
  assert(typeof blocker.id === "string" && blocker.id.length > 0, "each blocker needs an id");
  assert(typeof blocker.title === "string" && blocker.title.length > 0, `${blocker.id} needs a title`);
  assert(typeof blocker.status === "string" && blocker.status.length > 0, `${blocker.id} needs a status`);
  assert(typeof blocker.why_blocking === "string" && blocker.why_blocking.length > 0, `${blocker.id} needs why_blocking`);
  assert(Array.isArray(blocker.current_evidence) && blocker.current_evidence.length > 0, `${blocker.id} needs current_evidence`);
  assert(Array.isArray(blocker.exit_criteria) && blocker.exit_criteria.length > 0, `${blocker.id} needs exit_criteria`);
}

if (failures.length > 0) {
  console.error("Submission blocker ledger validation failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

const openBlockers = payload.p0_blockers.filter((blocker) => blocker.status !== "closed");
if (openBlockers.length > 0) {
  console.error(`Murmur is not submission-ready: ${openBlockers.length} open P0 blocker(s).`);
  for (const blocker of openBlockers) {
    console.error(`- ${blocker.id}: ${blocker.title} [${blocker.status}]`);
  }
  process.exit(1);
}

console.log("Submission blocker ledger has no open P0 blockers.");
