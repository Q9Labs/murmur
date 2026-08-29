import assert from "node:assert/strict";
import test from "node:test";

import { findOpenSubmissionBlockers, validateSubmissionBlockerLedger } from "./submission-blockers.mjs";

const validLedger = {
  status: "not_submission_ready",
  policy_sources_checked: [
    { url: "https://developer.apple.com/app-store/review/guidelines/" },
    { url: "https://developer.apple.com/documentation/storekit" },
    { url: "https://support.google.com/googleplay/android-developer/answer/10144311" },
    { url: "https://developer.android.com/google/play/billing" }
  ],
  p0_blockers: [
    {
      id: "billing-sandbox",
      title: "Complete billing sandbox evidence",
      status: "open",
      why_blocking: "Purchases are not proven.",
      current_evidence: ["The lifecycle test has not run."],
      exit_criteria: ["Complete the lifecycle test."]
    }
  ]
};

test("accepts a valid ledger while reporting open blockers separately", () => {
  assert.deepEqual(validateSubmissionBlockerLedger(validLedger), []);
  assert.deepEqual(findOpenSubmissionBlockers(validLedger).map((blocker) => blocker.id), ["billing-sandbox"]);
});

test("reports malformed blocker records", () => {
  const failures = validateSubmissionBlockerLedger({
    status: "unknown",
    policy_sources_checked: [],
    p0_blockers: [{ id: "", status: "open" }]
  });

  assert.ok(failures.includes("status must be explicit"));
  assert.ok(failures.includes("policy_sources_checked should include Apple and Google sources"));
  assert.ok(failures.includes("each blocker needs an id"));
  assert.ok(failures.some((failure) => failure.endsWith("needs exit_criteria")));
});

test("reports a malformed blocker collection without throwing", () => {
  const failures = validateSubmissionBlockerLedger({
    status: "not_submission_ready",
    policy_sources_checked: validLedger.policy_sources_checked,
    p0_blockers: {}
  });

  assert.deepEqual(failures, ["p0_blockers must be an array"]);
});

test("reports no open blockers when every blocker is closed", () => {
  const closedLedger = {
    ...validLedger,
    status: "submission_ready",
    p0_blockers: validLedger.p0_blockers.map((blocker) => ({ ...blocker, status: "closed" }))
  };

  assert.deepEqual(findOpenSubmissionBlockers(closedLedger), []);
});
