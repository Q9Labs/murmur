import { randomBytes, createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";

const base = "https://murmur-worker-sandbox.msbilal.workers.dev";
const apiBase = "https://api.cloudflare.com/client/v4/accounts/5281943bd26d5bdcf4c3915606cd6bfb/workers";
const fixture = process.env.MURMUR_DIAGNOSTICS_FIXTURE;
const version = process.env.MURMUR_LOG_PROOF_VERSION;
const sha = process.env.MURMUR_LOG_PROOF_SHA;
if (!fixture || !process.env.CLOUDFLARE_API_TOKEN || !version || !/^[a-f0-9]{40}$/.test(sha ?? "")) throw new Error("Supply sandbox fixture, token, deployed version and full source SHA");
const run = randomBytes(8).toString("hex");
const trace = randomBytes(16).toString("hex");
const start = Date.now();
const probes = [];
const sentinels = [];
const cases = ["rate_load", "rate_save", "alarm_load", "alarm_save", "ledger_bind_read", "ledger_bind_write", "ledger_execute"];
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function api(path, body) {
  const response = await fetch(apiBase + path, { method: body ? "POST" : "GET", headers: { Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`, "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(30_000) });
  const data = await response.json();
  if (!response.ok || !data.success) throw new Error(`Cloudflare proof read failed: ${response.status}`);
  return data.result;
}
const metadata = await api(`/scripts/murmur-worker-sandbox/versions/${version}`);
if (metadata.annotations?.["workers/tag"] !== sha) throw new Error("Deployed version tag does not match the complete source SHA");
async function request(path, init = {}) {
  return fetch(base + path, { ...init, headers: { Authorization: `Bearer ${fixture}`, ...init.headers }, signal: AbortSignal.timeout(30_000) });
}
let envelopes;
let authEvent;
try {
  const cleared = await request("/__diagnostics/privacy?case=cleanup-envelopes", { method: "DELETE" });
  if (!cleared.ok) throw new Error("Envelope collector reset failed");
  for (const name of cases) {
    const email = `private-${run}-${name.replaceAll("_", "-")}@example.invalid`;
    sentinels.push(email);
    const from = Date.now();
    const response = await request(`/__diagnostics/privacy?case=${name}&run=${run}`, { method: "POST", headers: { "x-probe-email": email } });
    const expectedStatus = name.startsWith("alarm") ? 200 : 503;
    if (response.status !== expectedStatus) throw new Error(`Probe ${name} returned ${response.status}, expected ${expectedStatus}`);
    // Native alarm callbacks run on the platform scheduler, not a direct method call.
    if (name.startsWith("alarm")) await pause(3500);
    probes.push({ name, from, to: Date.now(), status: response.status });
  }
  const email = `private-${run}-auth@example.invalid`;
  sentinels.push(email);
  const response = await request("/api/auth/sign-in/anonymous", {
    method: "POST", headers: { "Content-Type": "application/json", "x-probe-operation": "database", "x-probe-email": email, traceparent: `00-${trace}-1234567890abcdef-00` }, body: "{}",
  });
  if (response.status !== 500 || response.headers.get("X-Diagnostic-Code") !== trace) throw new Error("Auth failure did not return a correlated 500");
  await pause(3000); // Longer than the production SDK's bounded transport deadline.
  for (const delay of [1000, 2000, 4000]) {
    await pause(delay);
    const received = await request("/__diagnostics/privacy?case=envelopes");
    if (!received.ok) throw new Error("Envelope collector read failed");
    envelopes = await received.json();
    if (Array.isArray(envelopes) && envelopes.some((body) => body.includes(trace))) break;
  }
  if (!Array.isArray(envelopes)) throw new Error("Invalid envelope collector response");
  const matched = envelopes.filter((body) => body.includes(trace) && body.includes('"type":"event"'));
  if (matched.length !== 1 || envelopes.length !== 1) throw new Error(`Expected exactly one real SDK envelope; received ${envelopes.length}`);
  authEvent = envelopes[0].split("\n").map((line) => JSON.parse(line)).find((item) => item.tags?.trace_id === trace);
  if (!authEvent?.event_id) throw new Error("Auth SDK envelope has no matching event/trace identity");
} finally {
  for (const name of cases) {
    const response = await request(`/__diagnostics/privacy?case=${name}&run=${run}`, { method: "DELETE" });
    if (!response.ok) throw new Error(`Probe cleanup failed: ${name}`);
  }
  const response = await request("/__diagnostics/privacy?case=cleanup-envelopes", { method: "DELETE" });
  if (!response.ok) throw new Error("Envelope collector cleanup failed");
}
let records;
for (const delay of [10000, 20000, 30000]) {
  await pause(delay);
  const query = { queryId: `boundaries-${run}`, view: "events", limit: 1000, timeframe: { from: start - 1000, to: Date.now() },
    parameters: { datasets: [], filterCombination: "and", filters: [
      { key: "$metadata.service", operation: "eq", type: "string", value: "murmur-worker-sandbox" },
      { key: "$workers.scriptVersion.id", operation: "eq", type: "string", value: version },
    ] },
  };
  const result = await api("/observability/telemetry/query", query);
  records = result.events?.events;
  if (!records?.length || records.length >= 1000 || result.events.count > records.length || records.some((event) => event.$workers?.truncated)) throw new Error("Incomplete boundary record retrieval");
  if (records.some((event) => event.source?.trace_id === trace)) break;
}
const serialized = JSON.stringify({ records, envelopes });
if ([...sentinels, fixture].some((value) => serialized.includes(value) || serialized.includes(encodeURIComponent(value)))) throw new Error("Private value present in complete retained records or Sentry envelope");
for (const probe of probes) {
  const code = probe.name.startsWith("ledger") ? "customer_ledger_request_failed" : probe.name.startsWith("alarm") ? "rate_limiter_alarm_failed" : "rate_limiter_request_failed";
  // Native alarms have no request path; bind those controls to their disjoint time windows.
  // fallow-ignore-next-line complexity
  const found = records.some((event) => event.$workers?.executionModel === "durableObject" && JSON.stringify(event.source).includes(code) && (probe.name.startsWith("alarm") ? event.$workers?.eventType === "alarm" && event.timestamp >= probe.from && event.timestamp <= probe.to : event.$workers?.event?.request?.path?.endsWith(`/probe/${probe.name}`)));
  if (!found) throw new Error(`Missing native runtime positive control: ${probe.name}`);
}
const outcomes = records.filter((event) => event.source?.trace_id === trace && event.source.attributes?.error_code === "worker.request_failed");
if (outcomes.length !== 1) throw new Error(`Expected one retained auth outcome; received ${outcomes.length}`);
if (outcomes[0].source.sentry_event_id !== authEvent.event_id) throw new Error("Auth outcome does not match the SDK envelope event ID");
const invocation = records.some((event) => event.$metadata?.type === "cf-worker-event");
const queryString = records.some((event) => JSON.stringify(event.$workers?.event?.request ?? {}).includes("?"));
if (invocation || queryString) throw new Error("Unsafe invocation/query metadata");
const receipt = { run, source_sha: sha, version, version_tag: metadata.annotations["workers/tag"], probes, auth_trace: trace, auth_outcomes: outcomes.length, auth_envelopes: envelopes.length, retained_records: records.length, sentinel_matches: 0, full_record_and_envelope_sha256: createHash("sha256").update(serialized).digest("hex") };
await mkdir("artifacts/observability", { recursive: true });
await writeFile("artifacts/observability/boundary-records.json", JSON.stringify(records, null, 2));
await writeFile("artifacts/observability/boundary-envelopes.json", JSON.stringify(envelopes, null, 2));
await writeFile("artifacts/observability/boundary-receipt.json", JSON.stringify(receipt, null, 2));
console.log(JSON.stringify(receipt));
