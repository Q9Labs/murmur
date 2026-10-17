import { createHash, randomBytes, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { assertTranscriptAbsent, firstTranslation } from "./first-translation.mjs";

// Run only against a deployed sandbox build with invocation logs off and query redaction on.
const account = process.env.CLOUDFLARE_ACCOUNT_ID ?? "5281943bd26d5bdcf4c3915606cd6bfb";
const token = process.env.CLOUDFLARE_API_TOKEN;
const fixture = process.env.MURMUR_DIAGNOSTICS_FIXTURE;
const version = process.env.MURMUR_LOG_PROOF_VERSION;
const sha = process.env.MURMUR_LOG_PROOF_SHA;
if (!token || !fixture || !version || !/^[a-f0-9]{40}$/.test(sha ?? "")) throw new Error("Cloudflare token, sandbox fixture, deployed version and full source SHA are required");
if (!process.env.MURMUR_TRANSLATION_PCM) throw new Error("Supply the on-call good-morning.pcm fixture; a handshake alone cannot pass this proof");
const pcm = await readFile(process.env.MURMUR_TRANSLATION_PCM);
const fixtureSha256 = "8367b2effbee45c55c563ce3954d809b5bb914f0b9ae93975eedcdffd9a5b0fb";
if (pcm.length !== 89114 || createHash("sha256").update(pcm).digest("hex") !== fixtureSha256) throw new Error("On-call speech fixture checksum mismatch");
const base = "https://murmur-worker-sandbox.msbilal.workers.dev";
const runId = randomBytes(8).toString("hex");
const sentinels = ["PRIVATE_TEXT_", "PRIVATE_TOKEN_", "private-email-"].map((prefix) => prefix + runId);
const [text, secret, emailLocal] = sentinels;
const rows = [];
const start = Date.now();
let cookie;
let authToken;
let userId;
let expected;
let authDeleteTrace;
let translation;
const headers = {
  "Content-Type": "application/json", Authorization: `Bearer ${secret}`,
  "X-Private-Email": `${emailLocal}@example.invalid`, "X-Murmur-Free-Allowance-Id": randomUUID(),
  Cookie: `private=${secret}`, "User-Agent": text, Referer: `${base}/?private=${text}`,
};
// HTTP fixture boundary handles optional bodies, parsing and per-request correlation.
// fallow-ignore-next-line complexity
async function request(path, method = "GET", body, extra = {}) {
  const trace = randomBytes(16).toString("hex");
  const response = await fetch(`${base}${path}${path.includes("?") ? "&" : "?"}private=${text}&token=${secret}&email=${emailLocal}%40example.invalid`, {
    method, headers: { ...headers, traceparent: `00-${trace}-${randomBytes(8).toString("hex")}-00`, ...extra },
    body: body === undefined ? undefined : JSON.stringify(body), redirect: "manual", signal: AbortSignal.timeout(20000),
  });
  const raw = await response.text();
  let result;
  try { result = JSON.parse(raw); } catch { result = {}; }
  rows.push({ path: path.includes(text) ? "[private path]" : path, method, status: response.status, trace, ray: response.headers.get("cf-ray")?.split("-")[0] });
  return { response, result, trace_id: trace };
}
async function api(path, body) {
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}${path}`, {
    method: body ? "POST" : "GET", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(20000),
  });
  const value = await response.json();
  if (!value.success) throw new Error(`Cloudflare query failed (${response.status})`);
  return value.result;
}
function requireStatus(receipt, status, operation) {
  if (receipt.response.status !== status) throw new Error(`${operation}: expected ${status}, got ${receipt.response.status}; safe code=${receipt.result.error ?? receipt.result.code ?? "none"}`);
}
const deployed = await api(`/workers/scripts/murmur-worker-sandbox/versions/${version}`);
if (deployed.annotations?.["workers/tag"] !== sha) throw new Error("Deployed tag does not match the full proof source SHA");
const proofDatabase = deployed.resources.bindings.find((binding) => binding.name === "BILLING_DB" && binding.type === "d1")?.id;
if (!/^[a-f0-9-]{36}$/.test(proofDatabase ?? "")) throw new Error("Proof version is missing its D1 binding");
let failure;
try {
  for (const path of ["/", "/privacy", "/terms", "/support", "/health", "/ready", "/v3/config", "/v3/customer", "/v1/reports"]) await request(path);
  await request("/v2/session", "OPTIONS");
  await request("/v1/session", "POST", { text });
  for (const [method, path] of [["POST", "/v3/gifts/phone-audio/claim"], ["PUT", "/v3/insights/consent"], ["POST", "/v3/attribution"], ["POST", "/v3/ratings"], ["POST", "/v3/billing/reconcile"], ["POST", "/v3/webhooks/revenuecat"], ["POST", "/v1/telemetry"], ["POST", "/v1/diagnostics"], ["POST", "/v1/report"], ["DELETE", `/v1/reports/${text}`]]) await request(path, method, { text, email: `${emailLocal}@example.invalid`, token: secret });
  await request("/api/auth/sign-in/email-otp", "POST", { email: `${emailLocal}@example.invalid`, otp: "000000" });
  await request(`/v2/session/${text}/stop`, "POST", { note: text });
  await request(`/api/auth/${text}`, "POST", { text });
  await request(`/${text}`, "POST", { text });
  const error = await request("/__diagnostics/failure", "GET", undefined, { Authorization: `Bearer ${fixture}` });
  requireStatus(error, 500, "synthetic error");
  const anon = await request("/api/auth/sign-in/anonymous", "POST", {});
  requireStatus(anon, 200, "anonymous sign-in");
  cookie = anon.response.headers.getSetCookie().map((value) => value.split(";")[0]).join("; ");
  authToken = anon.result.token;
  userId = anon.result.user?.id;
  if (!cookie && !authToken) throw new Error("Anonymous sign-in did not provide a session");
  const auth = { Cookie: cookie, Authorization: `Bearer ${authToken ?? secret}` };
  const relay = { trace_id: randomBytes(16).toString("hex"), span_id: randomBytes(8).toString("hex"), timestamp: new Date().toISOString(), release: "com.q9labsai.murmur@1.3.1+130", source_surface: "ios", error_code: "mobile.operation_failed", outcome: "failed", duration_ms: 7 };
  const rejected = await request("/v1/diagnostics", "POST", { events: [{ ...relay, details: text }] }, auth);
  requireStatus(rejected, 400, "private relay rejection");
  const accepted = await request("/v1/diagnostics", "POST", { events: [relay] }, auth);
  requireStatus(accepted, 202, "authenticated relay");
  const session = await request("/v2/session", "POST", { app_install_id: text, app_platform: "ios", app_version: "1.3.1", source_language: "en", target_language: "es", playback_enabled: false, analytics_enabled: false, acquisition: { source: text, campaign: text } }, auth);
  requireStatus(session, 200, "session creation");
  const sessionId = session.result.app_session_id;
  if (!/^[a-f0-9-]{36}$/.test(sessionId)) throw new Error("Session response missing UUID");
  const report = await request("/v1/report", "POST", { app_session_id: sessionId, span_id: "span_12345678_i", revision: 1, error_category: "other", source_language: "en", target_language: "ar", optional_source_text_snapshot: text, optional_translated_text_snapshot: text, optional_user_note: text, provider_metadata: { text, token: secret, email: `${emailLocal}@example.invalid` } }, auth);
  requireStatus(report, 202, "report creation");
  const socket = new WebSocket(`${base.replace("https:", "wss:")}/v2/realtime?app_session_id=${text}&private=${text}&token=${secret}`);
  await new Promise((resolve) => {
    const timeout = setTimeout(() => { socket.close(); resolve(); }, 15000);
    const done = () => { clearTimeout(timeout); socket.close(); resolve(); };
    socket.addEventListener("error", done, { once: true });
    socket.addEventListener("open", done, { once: true });
  });
  rows.push({ path: "/v2/realtime", method: "WebSocket", status: "handshake sent" });
  const realtimeUrl = new URL(session.result.realtime_ws_url);
  realtimeUrl.searchParams.set("private", text);
  realtimeUrl.searchParams.set("token", secret);
  realtimeUrl.searchParams.set("email", `${emailLocal}@example.invalid`);
  translation = await firstTranslation({ realtimeUrl, pcm, expectedOrigin: base.replace("https:", "wss:") });
  rows.push({ path: "/v2/realtime", method: "WebSocket", status: "first translation received", ...translation });
  requireStatus(await request(`/v2/session/${sessionId}/stop`, "POST", { text }, auth), 200, "session stop");
  expected = { error_trace: error.result.diagnostic_code, relay_trace: relay.trace_id, report_id: report.result.report_id, session_id: sessionId };
  rows.push(expected);
} catch (error) { failure = error; }
finally {
  if (cookie || authToken) {
    const deleted = await request("/api/auth/delete-user", "POST", {}, { Cookie: cookie, Authorization: `Bearer ${authToken ?? secret}` });
    if (deleted.response.status === 500) authDeleteTrace = deleted.trace_id;
    // This old sandbox lacks insight tables required by the account-delete hook.
    // Delete only this run's synthetic auth rows if that hook cannot finish.
    if (deleted.response.status !== 200 && typeof userId === "string" && /^[a-f0-9-]{36}$/.test(userId)) {
      for (const [table, column] of [["session", "userId"], ["account", "userId"], ["user", "id"]]) {
        await api(`/d1/database/${proofDatabase}/query`, { sql: `DELETE FROM "${table}" WHERE "${column}" = ?`, params: [userId] });
      }
    }
  }
}
await mkdir("artifacts/observability", { recursive: true });
await writeFile("artifacts/observability/privacy-requests.json", JSON.stringify({ run_id: runId, rows }, null, 2));
if (failure) throw failure;
let records;
for (const delay of [120000, 60000, 120000]) {
  await new Promise((resolve) => setTimeout(resolve, delay));
  const result = await api("/workers/observability/telemetry/query", {
    queryId: `privacy-${runId}`, view: "events", limit: 1000, timeframe: { from: start - 5000, to: Date.now() },
    parameters: { datasets: [], filterCombination: "and", filters: [
      { key: "$metadata.service", operation: "eq", type: "string", value: "murmur-worker-sandbox" },
      { key: "$workers.scriptVersion.id", operation: "eq", type: "string", value: version },
    ] },
  });
  records = result.events?.events;
  if (result.events?.count > records?.length) throw new Error("Retained query omitted matching records");
  if (records?.some((event) => event.source?.report_id === expected.report_id) && records.some((event) => event.source?.event === "session_stop" && event.source.app_session_id === expected.session_id) && records.some((event) => event.source?.trace_id === expected.error_trace && event.source?.attributes?.error_code === "worker.request_failed") && records.some((event) => event.source?.trace_id === expected.relay_trace && event.source?.attributes?.error_code === "mobile.operation_failed") && (!authDeleteTrace || records.some((event) => event.source?.trace_id === authDeleteTrace))) break;
}
if (!records?.length || records.length >= 1000 || records.some((event) => event.$workers?.truncated || event.$cloudflare?.truncated)) throw new Error("Incomplete retained record retrieval");
const serialized = JSON.stringify(records);
assertTranscriptAbsent(records, translation);
const banned = [...sentinels, fixture, authToken, cookie, translation.caption, "Buenos días", "Good morning", "SYNTHETIC_PRIVATE_TRANSCRIPT", "secret=fixture-only"].filter(Boolean);
if (banned.some((value) => serialized.includes(value) || serialized.includes(encodeURIComponent(value)))) throw new Error("Private sentinel present in COMPLETE retained records");
const eventNames = records.map((event) => event.source?.event);
for (const name of ["session_created", "session_stop"]) {
  if (!records.some((event) => event.source?.event === name && event.source.app_session_id === expected.session_id)) throw new Error(`Missing current-run positive control: ${name}`);
}
if (!records.some((event) => event.source?.event === "translation_reported" && event.source.report_id === expected.report_id && /^[a-f0-9]{64}$/.test(event.source.translation_span_id))) throw new Error("Missing current-run report/digest");
if (!records.some((event) => event.source?.trace_id === expected.relay_trace && event.source?.attributes?.error_code === "mobile.operation_failed")) throw new Error("Missing current-run authenticated relay");
if (!records.some((event) => event.source?.trace_id === expected.error_trace && event.source?.attributes?.error_code === "worker.request_failed")) throw new Error("Missing current-run synthetic error");
if (authDeleteTrace && records.filter((event) => event.source?.trace_id === authDeleteTrace && event.source?.attributes?.error_code === "worker.request_failed").length !== 1) throw new Error("Missing single current-run account-delete failure outcome");
// Both metadata checks must inspect every complete record, including platform errors.
// fallow-ignore-next-line complexity
if (records.some((event) => JSON.stringify(event.$workers?.event?.request ?? {}).includes("?") || event.$metadata?.type === "cf-worker-event")) throw new Error("Unsafe invocation/query metadata");
// Persist complete records only after the all-field sentinel scan, never response bodies or cookies.
await writeFile("artifacts/observability/privacy-retained-records.json", JSON.stringify(records, null, 2));
const receipt = { run_id: runId, source_sha: sha, version, first_translation: { ...translation, fixture_sha256: fixtureSha256 }, auth_delete_trace: authDeleteTrace, request_count: rows.filter((row) => row.method).length, retained_count: records.length, complete_records_sha256: createHash("sha256").update(serialized).digest("hex"), sentinels_found: 0, invocation_logs: false, query_strings_present: false, source_events: [...new Set(eventNames.filter(Boolean))], retained_bytes: Buffer.byteLength(serialized), checked_at: new Date().toISOString() };
await writeFile("artifacts/observability/privacy-receipt.json", JSON.stringify(receipt, null, 2));
console.log(JSON.stringify(receipt));
