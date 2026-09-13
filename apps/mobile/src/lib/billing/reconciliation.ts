export type ReconciliationSnapshot = {
  purchaseCount: number;
  subscriptionCount: number;
};

export function didReconciliationAdvance(
  baseline: ReconciliationSnapshot | null,
  current: ReconciliationSnapshot,
): boolean {
  return baseline !== null && (
    current.purchaseCount > baseline.purchaseCount ||
    current.subscriptionCount > baseline.subscriptionCount
  );
}
