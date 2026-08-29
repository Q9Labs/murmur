#!/usr/bin/env node

const workerUrl = process.env.MURMUR_WORKER_URL ?? "https://murmur.q9labs.ai";
const baseUrl = workerUrl.replace(/\/+$/, "");
const currentLegalPageDate = "2026-08-29";
const failures = [];

const assert = (condition, message) => {
  if (!condition) {
    failures.push(message);
  }
};

const getJson = async (path) => {
  const response = await fetch(`${baseUrl}${path}`);
  const body = await response.text();
  let json = null;
  try {
    json = JSON.parse(body);
  } catch {
    failures.push(`${path} did not return JSON`);
  }

  return { body, json, response };
};

const getText = async (path) => {
  const response = await fetch(`${baseUrl}${path}`);
  const body = await response.text();
  return { body, response };
};

const health = await getJson("/health");
assert(health.response.status === 200, `/health must return 200; got ${health.response.status}`);
assert(health.json?.ok === true, "/health ok must be true");
assert(health.json?.env === "production", '/health env must be "production"');

const readiness = await getJson("/ready");
assert(readiness.response.status === 200, `/ready must return 200; got ${readiness.response.status}`);
assert(readiness.json?.ok === true, "/ready ok must be true");
assert(Array.isArray(readiness.json?.missing?.required), "/ready missing.required must be an array");
assert(readiness.json?.missing?.required?.length === 0, "/ready must have no missing required config");
assert(readiness.json?.providers?.realtime_translation === "configured", "/ready realtime translation provider must be configured");
assert(readiness.json?.providers?.report_webhook === "configured", "/ready report triage must be configured");
assert(readiness.json?.providers?.product_analytics === "configured", "/ready product analytics must be configured");
assert(readiness.json?.providers?.error_monitoring === "configured", "/ready error monitoring must be configured");

for (const path of ["/privacy", "/terms", "/support"]) {
  const page = await getText(path);
  const contentType = page.response.headers.get("content-type") ?? "";

  assert(page.response.status === 200, `${path} must return 200; got ${page.response.status}`);
  assert(contentType.includes("text/html"), `${path} must return text/html; got ${contentType}`);
  assert(page.response.headers.get("x-content-type-options") === "nosniff", `${path} must set X-Content-Type-Options: nosniff`);
  assert(page.body.includes("q9labs.ai@gmail.com"), `${path} must include support email`);
  assert(/\btap Listen\b/i.test(page.body), `${path} must include tap Listen reviewer/user copy`);
  assert(!/\btap Start\b|\bStart a session\b|\bstart a live session\b/.test(page.body), `${path} must not include stale Start CTA copy`);
  assert(page.body.includes(currentLegalPageDate), `${path} must include the current legal page date`);
}

const privacyPage = await getText("/privacy");
assert(privacyPage.body.includes("PostHog US"), "/privacy must disclose PostHog US");
assert(privacyPage.body.includes("Sentry"), "/privacy must disclose Sentry");
assert(privacyPage.body.includes("never include microphone audio"), "/privacy must prohibit conversation content in analytics");

if (failures.length > 0) {
  console.error(`Production Worker validation failed for ${baseUrl}:`);
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(`Production Worker validation passed for ${baseUrl}.`);
