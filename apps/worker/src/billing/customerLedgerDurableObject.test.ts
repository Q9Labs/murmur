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
