const LEDGER_STATUSES = new Set(["not_submission_ready", "submission_ready"]);
const APPLE_POLICY_URL = /^https:\/\/developer\.apple\.com\//;
const GOOGLE_POLICY_URL = /^https:\/\/(?:support\.google\.com\/google(?:play)|developer\.android\.com\/google\/play)\//;

const failureUnless = (condition, message) => (condition ? [] : [message]);

const arrayOrEmpty = (value) => (Array.isArray(value) ? value : []);

const isNonEmptyString = (value) => typeof value === "string" && value.length > 0;

const isNonEmptyArray = (value) => Array.isArray(value) && value.length > 0;

const policySourceUrl = (source) => (source || {}).url;

const isApplePolicySource = (source) => APPLE_POLICY_URL.test(policySourceUrl(source));

const isGooglePolicySource = (source) => GOOGLE_POLICY_URL.test(policySourceUrl(source));

const includesRequiredPolicyAuthorities = (sources) =>
  sources.some(isApplePolicySource) && sources.some(isGooglePolicySource);

const validateBlocker = (blocker) => {
  const record = blocker || {};

  return [
    ...failureUnless(isNonEmptyString(record.id), "each blocker needs an id"),
    ...failureUnless(isNonEmptyString(record.title), `${record.id} needs a title`),
    ...failureUnless(isNonEmptyString(record.status), `${record.id} needs a status`),
    ...failureUnless(isNonEmptyString(record.why_blocking), `${record.id} needs why_blocking`),
    ...failureUnless(isNonEmptyArray(record.current_evidence), `${record.id} needs current_evidence`),
    ...failureUnless(isNonEmptyArray(record.exit_criteria), `${record.id} needs exit_criteria`)
  ];
};

export const validateSubmissionBlockerLedger = (payload) => {
  const ledger = payload || {};
  const policySources = arrayOrEmpty(ledger.policy_sources_checked);
  const blockers = arrayOrEmpty(ledger.p0_blockers);

  return [
    ...failureUnless(LEDGER_STATUSES.has(ledger.status), "status must be explicit"),
    ...failureUnless(Array.isArray(ledger.policy_sources_checked), "policy_sources_checked must be an array"),
    ...failureUnless(policySources.length >= 4, "policy_sources_checked should include Apple and Google sources"),
    ...failureUnless(includesRequiredPolicyAuthorities(policySources), "policy_sources_checked must include trusted Apple and Google sources"),
    ...failureUnless(Array.isArray(ledger.p0_blockers), "p0_blockers must be an array"),
    ...blockers.flatMap(validateBlocker)
  ];
};

export const findOpenSubmissionBlockers = (payload) =>
  arrayOrEmpty((payload || {}).p0_blockers).filter((blocker) => blocker.status !== "closed");
