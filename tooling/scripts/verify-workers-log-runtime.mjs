import assert from "node:assert/strict";
import { startWorkerd } from "./workerd-process.mjs";
import { randomBytes } from "node:crypto";
import { once } from "node:events";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Exercise the actual entry point and SDK in workerd, not a mocked console function.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const workerRoot = resolve(root, "apps/worker");
const fixturePath = resolve(workerRoot, `.runtime-proof-${process.pid}.ts`);
const output = resolve(root, "scratchpad/runtime-proof/logs");
const fixture = "a".repeat(64);
const envelopes = [];
const stream = [];
const collector = createServer(async (request, response) => {
  let body = "";
  for await (const chunk of request) body += chunk;
  envelopes.push(body);
  response.end("{}");
});
collector.listen(0, "127.0.0.1");
await once(collector, "listening");
const collectorPort = collector.address().port;
const port = Number(process.env.MURMUR_RUNTIME_PROOF_PORT ?? 8913);
let stopRuntime;
await mkdir(output, { recursive: true });
try {
  await writeFile(fixturePath, `import worker from './src/entrypoint';
export { RateLimitDurableObject } from './src/entrypoint';
export { CustomerLedgerDurableObject } from './privacy-probe';
export default { fetch(request, env, context) {
  if (new URL(request.url).pathname === '/__proof/ledger') {
    return env.CUSTOMER_LEDGER.get(env.CUSTOMER_LEDGER.idFromName('runtime-ordinary-call')).fetch('https://customer-ledger.internal/');
  }
  console.error('PRIVATE_DEPENDENCY_EMAIL@example.invalid');
  const database = new Proxy(env.BILLING_DB, { get(target, key) {
    if (key === 'prepare') return () => { throw new Error('PRIVATE_AUTH_EMAIL@example.invalid'); };
    const value = Reflect.get(target, key, target);
    return typeof value === 'function' ? value.bind(target) : value;
  }});
  return worker.fetch(request, request.headers.has('x-proof-auth') ? { ...env, BILLING_DB: database } : env, context);
}};
`, { flag: "wx" });
  stopRuntime = await startWorkerd({ workerRoot, fixture: fixturePath, statePath: resolve(output, "state"), port, stream,
    variables: { MURMUR_DIAGNOSTICS_FIXTURE: fixture, SENTRY_DSN: `http://public@127.0.0.1:${collectorPort}/1`, BETTER_AUTH_SECRET: "a".repeat(32) },
  });
  const ordinaryLedger = await fetch(`http://127.0.0.1:${port}/__proof/ledger`, { signal: AbortSignal.timeout(15_000) });
  assert.equal(ordinaryLedger.status, 403, "sandbox ledger must pass ordinary calls through to the real class");
  assert.equal((await ordinaryLedger.json()).code, "invalid_ledger_command");
  const probes = [];
  for (const auth of [false, true]) {
    const trace = randomBytes(16).toString("hex");
    const response = await fetch(`http://127.0.0.1:${port}${auth ? "/api/auth/sign-in/anonymous" : "/__diagnostics/failure"}`, {
      method: auth ? "POST" : "GET", signal: AbortSignal.timeout(15_000),
      headers: { Authorization: `Bearer ${fixture}`, traceparent: `00-${trace}-1234567890abcdef-00`, ...(auth ? { "x-proof-auth": "1", "Content-Type": "application/json" } : {}) },
      body: auth ? "{}" : undefined,
    });
    probes.push({ name: auth ? "auth" : "synthetic", trace, status: response.status, body: await response.text() });
    assert.equal(response.status, 500);
    assert.equal(response.headers.get("X-Diagnostic-Code"), trace);
  }
  // SDK transport is bounded to two seconds; allow one more second for console forwarding.
  await new Promise((done) => setTimeout(done, 3500));
  const raw = stream.join("");
  for (const probe of probes) {
    assert.equal(raw.split("\n").filter((line) => line.includes(probe.trace) && line.includes('"error_code":"worker.request_failed"')).length, 1, `${probe.name}: safe outcome must reach the real runtime console`);
    assert.equal(envelopes.filter((body) => body.includes(probe.trace)).length, 1, `${probe.name}: actual SDK must send one envelope`);
  }
  assert.equal(envelopes.length, 2);
  assert.equal(/PRIVATE_|SYNTHETIC_PRIVATE_TRANSCRIPT/.test(raw + JSON.stringify(envelopes)), false);
  await writeFile(resolve(output, "receipt.json"), JSON.stringify({ probes, envelopes: envelopes.length, sentinel_matches: 0 }, null, 2));
  await writeFile(resolve(output, "envelopes.json"), JSON.stringify(envelopes, null, 2));
  console.log("workerd: two safe outcomes, two actual SDK envelopes, zero private values");
} finally {
  await stopRuntime?.();
  collector.closeAllConnections();
  await new Promise((done) => collector.close(done));
  await unlink(fixturePath).catch(() => {});
  await writeFile(resolve(output, "console.log"), stream.join(""));
}
