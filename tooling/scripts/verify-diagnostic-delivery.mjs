import { mkdir, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { resolve } from "node:path";

// Synthetic sandbox only. Reads a tail by diagnostic code, never prints request/credential data.
const account = process.env.CLOUDFLARE_ACCOUNT_ID;
const token = process.env.CLOUDFLARE_API_TOKEN;
const fixture = process.env.MURMUR_DIAGNOSTICS_FIXTURE;
const base = process.env.MURMUR_DIAGNOSTICS_BASE_URL;
if (!account || !token || !fixture || !base || !/^https:\/\/murmur-worker-sandbox\.[a-z0-9-]+\.workers\.dev$/.test(base)) {
  throw new Error("Sandbox URL, fixture credential, and Cloudflare account/API configuration are required");
}
const diagnosticCode = randomBytes(16).toString("hex");
const resource = `/accounts/${account}/workers/scripts/murmur-worker-sandbox/tails`;
async function api(path, method, body) {
  const response = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    method, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Cloudflare ${method} failed (${response.status})`);
  const result = await response.json();
  if (!result.success) throw new Error("Cloudflare operation failed");
  return result.result;
}
// Inspect every custom log and exception in the invocation, not just the selected outcome.
// The live sandbox delivery proof exercises this parser against the actual tail shape.
// fallow-ignore-next-line complexity
function findOutcome(event) {
  const record = { logs: event.logs ?? [], exceptions: event.exceptions ?? [] };
  if (!Array.isArray(record.logs) || !Array.isArray(record.exceptions)) throw new Error("Invalid stream batch");
  if (/SYNTHETIC_PRIVATE_TRANSCRIPT|PRIVATE_TRANSCRIPT_SENTINEL|secret=fixture/i.test(JSON.stringify(record)) ||
    JSON.stringify(record).includes(fixture)) throw new Error("Private fixture escaped in the complete log batch");
  for (const log of event.logs ?? []) {
    for (const message of log.message ?? []) {
      let outcome;
      try { outcome = typeof message === "string" ? JSON.parse(message) : message; } catch { continue; }
      if (outcome?.trace_id !== diagnosticCode) continue;
      if (outcome.attributes?.error_code !== "worker.request_failed" || outcome.synthetic !== true ||
        outcome["deployment.environment"] !== "sandbox" || !outcome.sentry_event_id ||
        /SYNTHETIC_PRIVATE_TRANSCRIPT|secret=fixture|authorization/i.test(JSON.stringify(outcome))) {
        throw new Error("Retrieved outcome failed classification/privacy/correlation checks");
      }
      const at = typeof outcome._time === "string" ? Date.parse(outcome._time) : NaN;
      const duration = outcome.attributes.duration_ms;
      if (!Number.isFinite(at) || typeof outcome.span_id !== "string" || !/^(?!0{16}$)[a-f0-9]{16}$/.test(outcome.span_id) ||
        typeof outcome.sentry_event_id !== "string" || !/^(?!0{32}$)[a-f0-9]{32}$/.test(outcome.sentry_event_id) ||
        typeof outcome["service.version"] !== "string" || !/^murmur-worker@\d{1,4}\.\d{1,4}\.\d{1,4}\+[a-f0-9]{7,40}$/.test(outcome["service.version"]) ||
        !Number.isSafeInteger(duration) || duration < 0 || duration > 86_400_000) {
        throw new Error("Retrieved outcome contained invalid receipt fields");
      }
      // Persist the fixed safe envelope, never raw platform records or extra log fields.
      return { log_count: record.logs.length, exception_count: record.exceptions.length, outcome: {
        _time: new Date(at).toISOString(), trace_id: diagnosticCode, span_id: outcome.span_id,
        "service.name": "murmur-worker", "service.version": outcome["service.version"],
        "deployment.environment": "sandbox", body: "Worker request did not complete", severity_text: "ERROR",
        attributes: { action: "http_request", reason: "unknown", error_code: "worker.request_failed",
          outcome: "failed", duration_ms: duration, retryable: false },
        synthetic: true, sentry_event_id: outcome.sentry_event_id,
      } };
    }
  }
}
let socket;
let tail;
const timeout = setTimeout(() => { socket?.close(); }, 120_000);
const receipt = { diagnostic_code: diagnosticCode, retrieved: false, source: "workers-tail", production: false };
let stage = "tail";
try {
  tail = await api(resource, "POST", { filters: [{ query: diagnosticCode }] });
  socket = new WebSocket(tail.url, "trace-v1");
  const received = new Promise((accept, reject) => {
    socket.addEventListener("message", async ({ data }) => {
      try {
        const event = JSON.parse(typeof data === "string" ? data : await data.text());
        const outcome = findOutcome(event);
        if (outcome) accept(outcome);
      } catch (error) { reject(error); }
    });
    socket.addEventListener("error", () => reject(new Error("Workers tail connection failed")));
    socket.addEventListener("close", () => reject(new Error("Workers tail closed before retrieval")));
  });
  // The stream can fail while the triggering HTTP request is still in flight.
  void received.catch(() => {});
  await new Promise((accept, reject) => {
    socket.addEventListener("open", accept, { once: true });
    socket.addEventListener("error", () => reject(new Error("Workers tail could not open")), { once: true });
    socket.addEventListener("close", () => reject(new Error("Workers tail closed")), { once: true });
  });
  socket.send(JSON.stringify({ debug: false }));
  const response = await fetch(`${base}/__diagnostics/failure`, {
    headers: { Authorization: `Bearer ${fixture}`, traceparent: `00-${diagnosticCode}-${randomBytes(8).toString("hex")}-00` },
    signal: AbortSignal.timeout(15_000),
  });
  const body = await response.json();
  if (response.status !== 500 || body.diagnostic_code !== diagnosticCode) throw new Error("Synthetic boundary did not return its code");
  const delivered = await received;
  receipt.outcome = delivered.outcome;
  receipt.stream_log_count = delivered.log_count;
  receipt.stream_exception_count = delivered.exception_count;
  receipt.complete_log_batch_checked = true;
  // Retained exports add Cloudflare metadata absent from our JSON line.
  stage = "retained_lookup";
  const at = Date.parse(delivered.outcome._time);
  const query = (filters) => api(`/accounts/${account}/workers/observability/telemetry/query`, "POST", {
    queryId: `murmur-pilot-${diagnosticCode}`, view: "events", limit: 100,
    timeframe: { from: at - 60_000, to: at + 60_000 },
    parameters: { datasets: [], filterCombination: "and", filters: [
      { key: "$metadata.service", operation: "eq", type: "string", value: "murmur-worker-sandbox" }, ...filters,
    ] },
  });
  let requestId;
  // Streaming delivery precedes retained indexing. Give indexing one bounded minute.
  for (const delay of [10_000, 20_000, 30_000]) {
    await new Promise((accept) => setTimeout(accept, delay));
    const matched = await query([{ key: "trace_id", operation: "eq", type: "string", value: diagnosticCode }]);
    requestId = matched.events?.events?.[0]?.$metadata?.requestId;
    if (requestId) break;
  }
  if (!requestId) throw new Error("Retained outcome did not include its request id");
  // Include records from the invocation that have no diagnostic code.
  stage = "complete_retained_invocation";
  const invocation = await query([{ key: "$metadata.requestId", operation: "eq", type: "string", value: requestId }]);
  const records = invocation.events?.events;
  if (!records?.length || records.length >= 100 || records.some((record) => record.$workers?.truncated)) {
    throw new Error("Complete retained invocation could not be retrieved");
  }
  const exported = JSON.stringify(records);
  if (/SYNTHETIC_PRIVATE_TRANSCRIPT|PRIVATE_TRANSCRIPT_SENTINEL|secret=fixture/i.test(exported) || exported.includes(fixture)) {
    throw new Error("Private fixture escaped in the complete retained record");
  }
  receipt.retained_record_count = records.length;
  receipt.complete_retained_invocation_checked = true;
  receipt.retrieved = true;
  receipt.retrieved_at = new Date().toISOString();
} catch {
  receipt.failed_stage = stage;
  receipt.error = "Delivery verification failed; check sandbox configuration and Cloudflare access";
  process.exitCode = 1;
} finally {
  clearTimeout(timeout);
  socket?.close();
  if (tail?.id) {
    try { await api(`${resource}/${tail.id}`, "DELETE"); receipt.tail_deleted = true; }
    catch { receipt.tail_deleted = false; process.exitCode = 1; }
  }
  const destination = resolve("artifacts/observability/live-delivery.json");
  await mkdir(resolve("artifacts/observability"), { recursive: true });
  await writeFile(destination, `${JSON.stringify(receipt, null, 2)}\n`);
  await new Promise((accept) => process.stdout.write(`${JSON.stringify({ diagnostic_code: diagnosticCode, retrieved: receipt.retrieved, receipt: destination })}\n`, accept));
}
// Native WebSocket close handshakes can keep Node alive after the tail is deleted.
// All cleanup and receipt writes have completed before ending this one-shot verifier.
process.exit(process.exitCode ?? 0);
