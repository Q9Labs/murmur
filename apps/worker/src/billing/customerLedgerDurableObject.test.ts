import { describe, expect, it } from "vitest";

import {
  callCustomerLedger,
  type CustomerLedgerNamespace,
} from "./customerLedgerDurableObject";

describe("customer ledger Durable Object client", () => {
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
