/// <reference types="@cloudflare/workers-types" />

export type OpenUsageSession = {
  customerId: string;
  generation: number;
  startedAtMs: number;
};

type UsageSessionRow = {
  customer_id: string;
  generation: number;
  started_at_ms: number;
  state: string;
};

export async function findOpenUsageSession(
  database: D1Database | undefined,
  usageSessionId: string,
): Promise<OpenUsageSession | null> {
  if (!database) {
    return null;
  }
  const row = await database
    .prepare(
      `SELECT customer_id, generation, started_at_ms, state
       FROM usage_sessions
       WHERE usage_session_id = ?`,
    )
    .bind(usageSessionId)
    .first<UsageSessionRow>();
  if (!row || row.state !== "open") {
    return null;
  }
  return {
    customerId: row.customer_id,
    generation: row.generation,
    startedAtMs: row.started_at_ms,
  };
}

export async function closeAbandonedUsageSessions(
  database: D1Database | undefined,
  nowMs: number,
): Promise<number> {
  if (!database) {
    return 0;
  }
  const result = await database
    .prepare(
      `UPDATE usage_sessions
       SET state = 'failed', ended_at_ms = ?, updated_at_ms = ?
       WHERE state = 'open' AND started_at_ms + max_session_seconds * 1000 <= ?`,
    )
    .bind(nowMs, nowMs, nowMs)
    .run();
  return result.meta.changes;
}
