import type { MurmurCustomer } from "./customerResponse";

export const defaultLowBalanceThresholdMinutes = 15;

const millisecondsPerMinute = 60_000;

export function isPaidCustomer(customer: MurmurCustomer): boolean {
  return customer.plan !== "free" || customer.creditMs > 0;
}

function remainingMinutes(customer: MurmurCustomer): number {
  return Math.max(0, Math.ceil(customer.availableMs / millisecondsPerMinute));
}

export function lowBalanceMinutes(
  customer: MurmurCustomer | null,
  thresholdMinutes: number,
): number | null {
  if (!customer || !isPaidCustomer(customer) || customer.availableMs <= 0) {
    return null;
  }
  const minutes = remainingMinutes(customer);
  return minutes <= thresholdMinutes ? minutes : null;
}

export function hasTimeAvailable(customer: MurmurCustomer | null): boolean {
  return customer !== null && customer.availableMs > 0;
}

export function lockedSurface(customer: MurmurCustomer | null): "out_of_minutes" | "paywall" {
  return customer !== null && customer.freeAllowanceMs !== 0 ? "out_of_minutes" : "paywall";
}

export function isHardPaywallLocked(customer: MurmurCustomer | null): boolean {
  return customer !== null && customer.freeAllowanceMs === 0 && customer.availableMs <= 0;
}
