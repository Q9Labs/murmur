export const validateSubmissionBlockerLedger = (payload) => {
  const failures = [];
  const assert = (condition, message) => {
    if (!condition) failures.push(message);
  };

  assert(payload?.status === "not_submission_ready" || payload?.status === "submission_ready", "status must be explicit");
  assert(Array.isArray(payload?.policy_sources_checked), "policy_sources_checked must be an array");
  assert((payload?.policy_sources_checked ?? []).length >= 4, "policy_sources_checked should include Apple and Google sources");
  assert(Array.isArray(payload?.p0_blockers), "p0_blockers must be an array");

  for (const blocker of payload?.p0_blockers ?? []) {
    assert(typeof blocker?.id === "string" && blocker.id.length > 0, "each blocker needs an id");
    assert(typeof blocker?.title === "string" && blocker.title.length > 0, `${blocker?.id} needs a title`);
    assert(typeof blocker?.status === "string" && blocker.status.length > 0, `${blocker?.id} needs a status`);
    assert(typeof blocker?.why_blocking === "string" && blocker.why_blocking.length > 0, `${blocker?.id} needs why_blocking`);
    assert(Array.isArray(blocker?.current_evidence) && blocker.current_evidence.length > 0, `${blocker?.id} needs current_evidence`);
    assert(Array.isArray(blocker?.exit_criteria) && blocker.exit_criteria.length > 0, `${blocker?.id} needs exit_criteria`);
  }

  return failures;
};

export const findOpenSubmissionBlockers = (payload) =>
  (payload?.p0_blockers ?? []).filter((blocker) => blocker.status !== "closed");
