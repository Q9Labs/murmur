import type { MurmurCustomer } from "./customerResponse";

// Must match the worker's `free_allowance_minutes` default in server config.
export const freeAllowanceMinutes = 5;

export const defaultLowBalanceThresholdMinutes = 15;

const millisecondsPerMinute = 60_000;

export function isPaidCustomer(customer: MurmurCustomer): boolean {
  return customer.plan !== "free" || customer.creditMs > 0;
}

export function remainingMinutes(customer: MurmurCustomer): number {
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
