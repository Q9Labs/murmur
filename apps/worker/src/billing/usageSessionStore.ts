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
