export type SpendableGrant = {
  createdAtMs: number;
  expiresAtMs: number | null;
  grantId: string;
  remainingMs: number;
};

export type GrantDebit = {
  amountMs: number;
  grantId: string;
};

export type DebitAllocation =
  | { availableMs: number; ok: false }
  | { allocations: GrantDebit[]; ok: true };

export function allocateDebit(
  grants: readonly SpendableGrant[],
  requestedMs: number,
  nowMs: number,
): DebitAllocation {
  if (!Number.isInteger(requestedMs) || requestedMs <= 0) {
    throw new RangeError("requestedMs must be a positive integer");
  }

  const available = grants
    .filter(
      (grant) =>
        grant.remainingMs > 0 &&
        (grant.expiresAtMs === null || grant.expiresAtMs > nowMs),
    )
    .sort(compareSpendOrder);
  const availableMs = available.reduce((total, grant) => total + grant.remainingMs, 0);
  if (availableMs < requestedMs) {
    return { availableMs, ok: false };
  }

  const allocations: GrantDebit[] = [];
  let remainingMs = requestedMs;
  for (const grant of available) {
    if (remainingMs === 0) {
      break;
    }
    const amountMs = Math.min(grant.remainingMs, remainingMs);
    allocations.push({ amountMs, grantId: grant.grantId });
    remainingMs -= amountMs;
  }
  return { allocations, ok: true };
}

function compareSpendOrder(left: SpendableGrant, right: SpendableGrant): number {
  if (left.expiresAtMs === null && right.expiresAtMs !== null) {
    return 1;
  }
  if (left.expiresAtMs !== null && right.expiresAtMs === null) {
    return -1;
  }
  if (left.expiresAtMs !== right.expiresAtMs) {
    return (left.expiresAtMs ?? 0) - (right.expiresAtMs ?? 0);
  }
  if (left.createdAtMs !== right.createdAtMs) {
    return left.createdAtMs - right.createdAtMs;
  }
  return left.grantId.localeCompare(right.grantId);
}
