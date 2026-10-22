import { defaultFreeAllowanceMs } from "./catalog";

export function mergedFreeRemainingMs(params: {
  destinationOriginalMs: number;
  destinationRemainingMs: number;
  sourceOriginalMs: number;
  sourceRemainingMs: number;
}): number {
  const sourceUsedMs = Math.max(0, params.sourceOriginalMs - params.sourceRemainingMs);
  const destinationUsedMs = Math.max(
    0,
    params.destinationOriginalMs - params.destinationRemainingMs,
  );
  return Math.max(0, defaultFreeAllowanceMs - sourceUsedMs - destinationUsedMs);
}
