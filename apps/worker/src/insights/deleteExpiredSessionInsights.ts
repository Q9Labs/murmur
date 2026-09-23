const RETENTION_MONTHS = 24;

export async function deleteExpiredSessionInsights(
  database: D1Database | undefined,
  nowMs: number,
): Promise<{ deletedInsights: number; deletedSessionContexts: number }> {
  if (!database) {
    return { deletedInsights: 0, deletedSessionContexts: 0 };
  }

  const cutoff = retentionCutoff(nowMs);
  const insights = await database
    .prepare("DELETE FROM session_insights WHERE created_at < ?")
    .bind(cutoff)
    .run();
  const sessionContexts = await database
    .prepare("DELETE FROM insight_session_context WHERE created_at < ?")
    .bind(cutoff)
    .run();

  return {
    deletedInsights: insights.meta.changes,
    deletedSessionContexts: sessionContexts.meta.changes,
  };
}

export function retentionCutoff(nowMs: number): string {
  const now = new Date(nowMs);
  const dayOfMonth = now.getUTCDate();
  const cutoff = new Date(now);
  cutoff.setUTCDate(1);
  cutoff.setUTCMonth(cutoff.getUTCMonth() - RETENTION_MONTHS);
  const lastDayOfCutoffMonth = new Date(
    Date.UTC(cutoff.getUTCFullYear(), cutoff.getUTCMonth() + 1, 0),
  ).getUTCDate();
  cutoff.setUTCDate(Math.min(dayOfMonth, lastDayOfCutoffMonth));
  return cutoff.toISOString();
}
