import { describe, expect, it } from "vitest";

import {
  freeAllowanceMinutes,
  hasTimeAvailable,
  isPaidCustomer,
  lowBalanceMinutes,
} from "./allowance";
import type { MurmurCustomer } from "./customerResponse";

const customer: MurmurCustomer = {
  allowanceMs: 0,
  availableMs: 12 * 60_000,
  creditMs: 0,
  customerId: "customer-1",
  earliestExpiryAtMs: null,
  fulfillmentEnabled: true,
  isRegistered: true,
  negativeMs: 0,
  plan: "pro",
  purchasesEnabled: true,
  revenueCatCustomerId: "customer-1",
};

describe("allowance rules", () => {
  it("matches the worker's five-minute free allowance", () => {
    expect(freeAllowanceMinutes).toBe(5);
  });

  it("treats Pro, Pro Max and top-up credit as paid", () => {
    expect(isPaidCustomer(customer)).toBe(true);
    expect(isPaidCustomer({ ...customer, plan: "pro_max" })).toBe(true);
    expect(isPaidCustomer({ ...customer, creditMs: 60_000, plan: "free" })).toBe(true);
    expect(isPaidCustomer({ ...customer, plan: "free" })).toBe(false);
  });

  it("flags a low balance only for paid customers at or under the threshold", () => {
    expect(lowBalanceMinutes(customer, 15)).toBe(12);
    expect(lowBalanceMinutes({ ...customer, availableMs: 15 * 60_000 }, 15)).toBe(15);
    expect(lowBalanceMinutes({ ...customer, availableMs: 16 * 60_000 }, 15)).toBeNull();
    expect(lowBalanceMinutes({ ...customer, plan: "free" }, 15)).toBeNull();
    expect(lowBalanceMinutes({ ...customer, availableMs: 0 }, 15)).toBeNull();
    expect(lowBalanceMinutes(null, 15)).toBeNull();
  });

  it("reports whether any translation time remains", () => {
    expect(hasTimeAvailable(customer)).toBe(true);
    expect(hasTimeAvailable({ ...customer, availableMs: 0 })).toBe(false);
    expect(hasTimeAvailable(null)).toBe(false);
  });
});
