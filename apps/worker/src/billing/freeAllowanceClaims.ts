import type { Env } from "../env";
import { hashInstallId } from "../privacy";

type FreeAllowanceClaimRow = {
  customer_id: string;
};

const freeAllowanceIdHeader = "x-murmur-free-allowance-id";
const localDevelopmentSalt = "local-development-salt";

export async function freeAllowanceClaimHashFromRequest(
  request: Request,
  env: Env,
): Promise<string | null> {
  const freeAllowanceId = request.headers.get(freeAllowanceIdHeader)?.trim();
  if (!freeAllowanceId || freeAllowanceId.length < 8 || freeAllowanceId.length > 256) {
    return null;
  }
  return hashInstallId(freeAllowanceId, env.SESSION_HASH_SALT ?? localDevelopmentSalt);
}

export async function claimFreeAllowance(params: {
  claimHash: string | null | undefined;
  customerId: string;
  database: D1Database | undefined;
  expiresAtMs: number;
  nowMs: number;
  periodKey: string;
}): Promise<boolean> {
  if (!params.database || !params.claimHash) {
    return false;
  }
  await params.database
    .prepare(
      `INSERT OR IGNORE INTO free_allowance_claims
        (claim_hash, period_key, customer_id, claimed_at_ms, expires_at_ms)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .bind(
      params.claimHash,
      params.periodKey,
      params.customerId,
      params.nowMs,
      params.expiresAtMs,
    )
    .run();
  const claim = await params.database
    .prepare(
      `SELECT customer_id
       FROM free_allowance_claims
       WHERE claim_hash = ? AND period_key = ?`,
    )
    .bind(params.claimHash, params.periodKey)
    .first<FreeAllowanceClaimRow>();
  return claim?.customer_id === params.customerId;
}

export async function deleteExpiredFreeAllowanceClaims(
  database: D1Database | undefined,
  nowMs: number,
): Promise<number> {
  if (!database) {
    return 0;
  }
  const result = await database
    .prepare("DELETE FROM free_allowance_claims WHERE expires_at_ms <= ?")
    .bind(nowMs)
    .run();
  return result.meta.changes;
}

export async function transferFreeAllowanceClaim(params: {
  claimHash: string;
  database: D1Database | undefined;
  destinationCustomerId: string;
  nowMs: number;
  periodKey: string;
  sourceCustomerId: string;
}): Promise<void> {
  if (!params.database) {
    throw new Error("billing database is unavailable during Free allowance transfer");
  }
  const result = await params.database
    .prepare(
      `UPDATE free_allowance_claims
       SET customer_id = ?, claimed_at_ms = ?
       WHERE claim_hash = ? AND period_key = ? AND customer_id = ?`,
    )
    .bind(
      params.destinationCustomerId,
      params.nowMs,
      params.claimHash,
      params.periodKey,
      params.sourceCustomerId,
    )
    .run();
  if (result.meta.changes === 1) {
    return;
  }
  const existing = await params.database
    .prepare(
      `SELECT customer_id
       FROM free_allowance_claims
       WHERE claim_hash = ? AND period_key = ?`,
    )
    .bind(params.claimHash, params.periodKey)
    .first<FreeAllowanceClaimRow>();
  if (existing?.customer_id !== params.destinationCustomerId) {
    throw new Error("Free allowance claim does not belong to the guest customer");
  }
}
