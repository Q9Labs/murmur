import { describe, expect, it, vi } from "vitest";

import {
  callCustomerLedger,
  CustomerLedgerDurableObject,
  type CustomerLedgerNamespace,
} from "./customerLedgerDurableObject";

describe("customer ledger Durable Object client", () => {
  it.each(["binding_read", "binding_write", "execution"])("sanitizes %s before the concurrency callback rejects", async (phase) => {
    const privateFailure = new Error("PRIVATE_DO_EMAIL@example.invalid");
    const runtimeFailures: unknown[] = [];
    const storage = { get: vi.fn(async () => undefined), put: vi.fn(async () => undefined) };
    if (phase === "binding_read") storage.get.mockRejectedValue(privateFailure);
    if (phase === "binding_write") storage.put.mockRejectedValue(privateFailure);
    // Substitute storage boundaries; observe the rejection seen by the runtime callback.
    const state = {
      storage,
      blockConcurrencyWhile: async <T>(callback: () => Promise<T>) => {
        try { return await callback(); } catch (failure) { runtimeFailures.push(failure); throw failure; }
      },
    } as unknown as DurableObjectState;
    const database = { prepare: () => { throw privateFailure; } } as unknown as D1Database;
    const durableObject = new CustomerLedgerDurableObject(state, { BILLING_DB: database });
    await expect(durableObject.fetch(new Request("https://customer-ledger.internal/", {
      method: "POST", headers: { "x-murmur-ledger-internal": "1" },
      body: JSON.stringify({ action: "get_balance", customerId: "fixture", nowMs: 1 }),
    }))).rejects.toThrow("customer_ledger_request_failed");
    expect(runtimeFailures).toHaveLength(1);
    expect(runtimeFailures[0]).toEqual(new Error("customer_ledger_request_failed"));
  });

  it.each([
    { kind: "missing", stage: "ledger_binding", code: "binding_missing", status: null },
    { kind: "request", stage: "ledger_request", code: "request_failed", status: null },
    { kind: "decode", stage: "ledger_decode", code: "decode_failed", status: 502 },
  ])("retains the safe $kind failure boundary", async ({ kind, stage, code, status }) => {
    const namespace: CustomerLedgerNamespace | undefined = kind === "missing" ? undefined : {
      idFromName: () => ({ equals: () => true, toString: () => "fixture" }),
      get: () => ({ fetch: async () => {
        if (kind === "request") throw new Error("private account secret");
        return new Response("private account secret", { status: 502 });
      } }),
    };
    const result = await callCustomerLedger(namespace, "fixture", {
      action: "get_balance", customerId: "fixture", nowMs: 1,
    });
    expect(result.diagnostic).toEqual({ stage, code, status });
    expect(result.result).toEqual({ ok: false, code: "billing_unavailable" });
    expect(JSON.stringify(result)).not.toContain("private account secret");
  });

  it("returns a typed unavailable result when the Durable Object request fails", async () => {
    const durableObjectId: DurableObjectId = {
      equals: () => true,
      toString: () => "customer-ledger-id",
    };
    const namespace: CustomerLedgerNamespace = {
      get: () => ({
        fetch: async () => {
          throw new Error("durable object unavailable");
        },
      }),
      idFromName: () => durableObjectId,
    };

    const result = await callCustomerLedger(namespace, "customer-1", {
      action: "get_balance",
      customerId: "customer-1",
      nowMs: 1,
    });

    expect(result.response.status).toBe(503);
    expect(result.result).toEqual({ code: "billing_unavailable", ok: false });
  });
});
