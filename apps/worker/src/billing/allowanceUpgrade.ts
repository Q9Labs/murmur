import { proAllowanceMs } from "./catalog";

export function firstProGrantMs(freeUsedMs: number, paidAllowanceMs = proAllowanceMs): number {
  if (!Number.isSafeInteger(freeUsedMs) || freeUsedMs < 0) {
    throw new RangeError("freeUsedMs must be a non-negative safe integer");
  }
  if (!Number.isSafeInteger(paidAllowanceMs) || paidAllowanceMs <= 0) {
    throw new RangeError("paidAllowanceMs must be a positive safe integer");
  }
  return Math.max(0, paidAllowanceMs - freeUsedMs);
}
