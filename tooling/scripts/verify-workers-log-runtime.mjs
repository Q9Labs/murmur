import assert from "node:assert/strict";
import { spawn } from "node:child_process";
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
const output = resolve(root, "artifacts/observability/runtime");
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
let child;
let watchdog;
let startupTimeout;
await mkdir(output, { recursive: true });
try {
  await writeFile(fixturePath, `import worker from './src/entrypoint';
export { RateLimitDurableObject, CustomerLedgerDurableObject } from './src/entrypoint';
export default { fetch(request, env, context) {
  console.error('PRIVATE_DEPENDENCY_EMAIL@example.invalid');
  const database = new Proxy(env.BILLING_DB, { get(target, key) {
    if (key === 'prepare') return () => { throw new Error('PRIVATE_AUTH_EMAIL@example.invalid'); };
    const value = Reflect.get(target, key, target);
    return typeof value === 'function' ? value.bind(target) : value;
  }});
  return worker.fetch(request, request.headers.has('x-proof-auth') ? { ...env, BILLING_DB: database } : env, context);
}};
`, { flag: "wx" });
  child = spawn("pnpm", ["exec", "wrangler", "dev", fixturePath, "--local", "--env", "sandbox",
    "--ip", "127.0.0.1", "--port", String(port), "--persist-to", resolve(output, "state"),
    "--var", `MURMUR_DIAGNOSTICS_FIXTURE:${fixture}`,
    "--var", `SENTRY_DSN:http://public@127.0.0.1:${collectorPort}/1`,
    "--var", `BETTER_AUTH_SECRET:${"a".repeat(32)}`],
  { cwd: workerRoot, detached: true, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, WRANGLER_SEND_METRICS: "false" } });
  const exit = once(child, "exit");
  const stop = () => { if (child.exitCode === null && child.signalCode === null) process.kill(-child.pid, "SIGTERM"); };
  watchdog = spawn(process.execPath, ["-e", `
    const deadline = Date.now() + 120000;
    setInterval(() => {
      try { process.kill(${child.pid}, 0); } catch { process.exit(0); }
      let ownerAlive = true;
      try { process.kill(${process.pid}, 0); } catch { ownerAlive = false; }
      if (!ownerAlive || Date.now() > deadline) {
        try { process.kill(-${child.pid}, 'SIGTERM'); } catch {}
        process.exit(0);
      }
    }, 1000);
  `], { detached: true, stdio: "ignore" });
  watchdog.unref();
  await new Promise((ready, reject) => {
    startupTimeout = setTimeout(() => reject(new Error("workerd startup timed out")), 90_000);
    const receive = (chunk) => { const line = chunk.toString(); stream.push(line); if (line.includes("Ready on")) ready(); };
    child.stdout.on("data", receive);
    child.stderr.on("data", receive);
    child.once("error", reject);
    child.once("exit", () => reject(new Error("workerd exited before readiness")));
  });
  clearTimeout(startupTimeout);
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
  stop();
  await exit;
} finally {
  clearTimeout(startupTimeout);
  if (watchdog?.exitCode === null && watchdog.signalCode === null) watchdog.kill("SIGTERM");
  if (child?.exitCode === null && child.signalCode === null) {
    process.kill(-child.pid, "SIGTERM");
    await once(child, "exit");
  }
  collector.closeAllConnections();
  await new Promise((done) => collector.close(done));
  await unlink(fixturePath).catch(() => {});
  await writeFile(resolve(output, "console.log"), stream.join(""));
}
