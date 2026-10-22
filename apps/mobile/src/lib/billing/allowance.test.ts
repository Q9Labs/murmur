import { describe, expect, it } from "vitest";

import {
  hasTimeAvailable,
  isHardPaywallLocked,
  lockedSurface,
  isPaidCustomer,
  lowBalanceMinutes,
} from "./allowance";
import type { MurmurCustomer } from "./customerResponse";

const customer: MurmurCustomer = {
  allowanceMs: 0,
  availableMs: 12 * 60_000,
  creditMs: 0,
  customerId: "customer-1",
  creditPacks: [],
  earliestExpiryAtMs: null,
  entitlements: { pro: true, proMax: false },
  features: { history: true, maxSessionSeconds: 3_600, phoneAudio: true },
  freeAllowanceMs: 300_000,
  fulfillmentEnabled: true,
  isRegistered: true,
  negativeMs: 0,
  plan: "pro",
  purchasesEnabled: true,
  revenueCatCustomerId: "customer-1",
};

describe("allowance rules", () => {
  it("chooses copy from the free tier and locks only an empty hard-mode balance", () => {
    expect(lockedSurface(customer)).toBe("out_of_minutes");
    expect(lockedSurface({ ...customer, freeAllowanceMs: null })).toBe("out_of_minutes");
    expect(isHardPaywallLocked({ ...customer, freeAllowanceMs: null, availableMs: 0 })).toBe(false);
    expect(lockedSurface({ ...customer, freeAllowanceMs: 0 })).toBe("paywall");
    expect(lockedSurface(null)).toBe("paywall");
    expect(isHardPaywallLocked({ ...customer, freeAllowanceMs: 0, availableMs: 0 })).toBe(true);
    expect(isHardPaywallLocked({ ...customer, freeAllowanceMs: 0, availableMs: -1 })).toBe(true);
    expect(isHardPaywallLocked({ ...customer, freeAllowanceMs: 0, availableMs: 1 })).toBe(false);
    expect(isHardPaywallLocked({ ...customer, availableMs: 0 })).toBe(false);
    expect(isHardPaywallLocked(null)).toBe(false);
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
