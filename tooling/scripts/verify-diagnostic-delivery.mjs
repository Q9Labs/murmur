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
// Workers tails nest JSON messages inside log batches; validate only the matching safe outcome.
// The live sandbox delivery proof exercises this parser against the actual tail shape.
// fallow-ignore-next-line complexity
function findOutcome(event) {
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
      return outcome;
    }
  }
}
let socket;
let tail;
const timeout = setTimeout(() => { socket?.close(); }, 120_000);
const receipt = { diagnostic_code: diagnosticCode, retrieved: false, source: "workers-tail", production: false };
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
  receipt.outcome = await received;
  receipt.retrieved = true;
  receipt.retrieved_at = new Date().toISOString();
} catch {
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
