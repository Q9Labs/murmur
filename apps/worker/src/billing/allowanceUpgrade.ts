import { proAllowanceMs } from "./catalog";

export function firstProGrantMs(freeUsedMs: number): number {
  if (!Number.isSafeInteger(freeUsedMs) || freeUsedMs < 0) {
    throw new RangeError("freeUsedMs must be a non-negative safe integer");
  }
  return Math.max(0, proAllowanceMs - freeUsedMs);
}
