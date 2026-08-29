const LEDGER_STATUSES = new Set(["not_submission_ready", "submission_ready"]);

const failureUnless = (condition, message) => (condition ? [] : [message]);

const arrayOrEmpty = (value) => (Array.isArray(value) ? value : []);

const isNonEmptyString = (value) => typeof value === "string" && value.length > 0;

const isNonEmptyArray = (value) => Array.isArray(value) && value.length > 0;

const validateBlocker = (blocker) => [
  ...failureUnless(isNonEmptyString(blocker?.id), "each blocker needs an id"),
  ...failureUnless(isNonEmptyString(blocker?.title), `${blocker?.id} needs a title`),
  ...failureUnless(isNonEmptyString(blocker?.status), `${blocker?.id} needs a status`),
  ...failureUnless(isNonEmptyString(blocker?.why_blocking), `${blocker?.id} needs why_blocking`),
  ...failureUnless(isNonEmptyArray(blocker?.current_evidence), `${blocker?.id} needs current_evidence`),
  ...failureUnless(isNonEmptyArray(blocker?.exit_criteria), `${blocker?.id} needs exit_criteria`)
];

export const validateSubmissionBlockerLedger = (payload) => {
  const policySources = arrayOrEmpty(payload?.policy_sources_checked);
  const blockers = arrayOrEmpty(payload?.p0_blockers);

  return [
    ...failureUnless(LEDGER_STATUSES.has(payload?.status), "status must be explicit"),
    ...failureUnless(Array.isArray(payload?.policy_sources_checked), "policy_sources_checked must be an array"),
    ...failureUnless(policySources.length >= 4, "policy_sources_checked should include Apple and Google sources"),
    ...failureUnless(Array.isArray(payload?.p0_blockers), "p0_blockers must be an array"),
    ...blockers.flatMap(validateBlocker)
  ];
};

export const findOpenSubmissionBlockers = (payload) =>
  (payload?.p0_blockers ?? []).filter((blocker) => blocker.status !== "closed");
