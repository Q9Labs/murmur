import { test } from "node:test";
import assert from "node:assert/strict";
import { rollbackWorkerLogs } from "./rollback-worker-logs.mjs";

const version = "2ca27398-d8d2-432e-9a4e-17cd99edd209";
const disabled = { observability: { enabled: false, logs: { enabled: false }, traces: { enabled: false } } };

for (const step of ["patch", "read", "verify", "deploy", "active"]) {
  test(`rollback stops at a failed ${step} step`, async () => {
    const calls = [];
    const request = async (_url, init) => {
      calls.push(init.method);
      const position = calls.length;
      const failurePosition = { patch: 1, read: 2, deploy: 3, active: 4 };
      if (position === failurePosition[step]) return Response.json({ success: false }, { status: 403 });
      if (position === 2) return Response.json({ success: true, result: step === "verify" ? { observability: { enabled: true } } : disabled });
      return Response.json({ success: true, result: {} });
    };
    await assert.rejects(rollbackWorkerLogs({ environment: "sandbox", version, token: "fixture", request }), /failed|did not match/);
    const expectedCalls = { patch: 1, read: 2, verify: 2, deploy: 3, active: 4 };
    assert.equal(calls.length, expectedCalls[step]);
    if (["patch", "read", "verify"].includes(step)) assert.ok(!calls.includes("POST"));
  });
}

test("rollback orders disable, verification, version restore and final read-back", async () => {
  const calls = [];
  const request = async (_url, init) => {
    calls.push(init.method);
    return Response.json({ success: true, result: calls.length === 2 ? disabled : calls.length === 4 ? { deployments: [{ versions: [{ version_id: version, percentage: 100 }] }] } : {} });
  };
  assert.equal((await rollbackWorkerLogs({ environment: "sandbox", version, token: "fixture", request })).version_verified, true);
  assert.deepEqual(calls, ["PATCH", "GET", "POST", "GET"]);
});

for (const [name, settings, accepted] of [["explicit null", { observability: null }, true], ["missing field", {}, false]]) {
  test(`rollback handles ${name} settings fail-closed`, async () => {
    const calls = [];
    const request = async (url, init) => {
      calls.push(init.method);
      if (calls.length === 2) assert.ok(url.endsWith("/script-settings"));
      return Response.json({ success: true, result: calls.length === 2 ? settings : calls.length === 4 ? { deployments: [{ versions: [{ version_id: version, percentage: 100 }] }] } : {} });
    };
    const result = rollbackWorkerLogs({ environment: "sandbox", version, token: "fixture", request });
    if (accepted) assert.equal((await result).version_verified, true);
    else await assert.rejects(result, /version rollback NOT attempted/);
    assert.deepEqual(calls, accepted ? ["PATCH", "GET", "POST", "GET"] : ["PATCH", "GET"]);
  });
}
