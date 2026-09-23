export async function deleteExpiredAuthSessions(
  database: D1Database | undefined,
  nowMs: number,
): Promise<number> {
  if (!database) return 0;

  const deleted = await database
    .prepare('DELETE FROM "session" WHERE "expiresAt" <= ?')
    .bind(new Date(nowMs).toISOString())
    .run();
  return deleted.meta.changes;
}
