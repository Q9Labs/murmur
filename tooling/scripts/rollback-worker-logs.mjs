import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";

const account = "5281943bd26d5bdcf4c3915606cd6bfb";

// Observability is not versioned. Never restore code until both writes and the
// settings read-back prove that retained logs and traces are disabled.
// Each guard is a fail-closed boundary check; retain the visible step ordering.
// fallow-ignore-next-line complexity
export async function rollbackWorkerLogs({ environment, version, token, request = fetch }) {
  if (!["sandbox", "production"].includes(environment) || !/^[a-f0-9-]{36}$/.test(version)) {
    throw new Error("Supply --env sandbox|production and --version <Worker version UUID>");
  }
  if (!token) throw new Error("CLOUDFLARE_API_TOKEN is required");
  const base = `https://api.cloudflare.com/client/v4/accounts/${account}/workers/scripts/murmur-worker-${environment}`;
  // Network, HTTP and JSON success are separate requirements.
  // fallow-ignore-next-line complexity
  async function api(path, method, body, step) {
    let response;
    try {
      response = await request(base + path, {
        method, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(30_000),
      });
      const data = await response.json();
      if (response.ok && data?.success === true && data.result && typeof data.result === "object") return data.result;
    } catch {
      throw new Error(`${step} failed: network or invalid response; stopped`);
    }
    throw new Error(`${step} failed (HTTP ${response.status}); stopped`);
  }
  await api("/script-settings", "PATCH", {
    observability: { enabled: false, logs: { enabled: false, persist: false, invocation_logs: false }, traces: { enabled: false, persist: false } },
  }, "Disable log export; version rollback NOT attempted");
  const settings = await api("/script-settings", "GET", undefined, "Verify disabled settings; version rollback NOT attempted");
  // Cloudflare returns explicit null when observability is fully disabled.
  // Missing or malformed fields are not evidence of disabled export.
  const disabled = settings.observability === null || (settings.observability?.enabled === false && settings.observability.logs?.enabled === false && settings.observability.traces?.enabled === false);
  if (!disabled) {
    throw new Error("Log/trace disable read-back did not match; version rollback NOT attempted");
  }
  await api("/deployments", "POST", {
    strategy: "percentage", versions: [{ version_id: version, percentage: 100 }],
    annotations: { "workers/message": "Fail-closed rollback of production log enablement" },
  }, "Restore version (log export is disabled)");
  const active = await api("/deployments", "GET", undefined, "Verify restored version (log export is disabled)");
  const versions = active?.deployments?.[0]?.versions;
  if (versions?.length !== 1 || versions[0].version_id !== version || versions[0].percentage !== 100) {
    throw new Error("Active version read-back did not match; log export remains disabled");
  }
  return { environment, version, logs_disabled: true, version_verified: true };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const { values } = parseArgs({ options: { env: { type: "string" }, version: { type: "string" } } });
    console.log(JSON.stringify(await rollbackWorkerLogs({ environment: values.env, version: values.version, token: process.env.CLOUDFLARE_API_TOKEN })));
  } catch (failure) {
    console.error(failure instanceof Error ? failure.message : "Rollback failed; stopped");
    process.exitCode = 1;
  }
}
