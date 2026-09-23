import { retentionCutoff } from "./deleteExpiredSessionInsights";

export async function deleteExpiredRatingSurveys(
  database: D1Database | undefined,
  nowMs: number,
): Promise<number> {
  if (!database) return 0;

  const deleted = await database
    .prepare("DELETE FROM rating_surveys WHERE created_at < ?")
    .bind(retentionCutoff(nowMs))
    .run();
  return deleted.meta.changes;
}
