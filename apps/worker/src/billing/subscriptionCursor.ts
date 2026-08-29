export type SubscriptionCursorValue = {
  eventId: string;
  lifecycleRank: number;
  occurredAtMs: number;
};

export function isNewerSubscriptionCursor(
  candidate: SubscriptionCursorValue,
  current: SubscriptionCursorValue,
): boolean {
  if (candidate.occurredAtMs !== current.occurredAtMs) {
    return candidate.occurredAtMs > current.occurredAtMs;
  }
  if (candidate.lifecycleRank !== current.lifecycleRank) {
    return candidate.lifecycleRank > current.lifecycleRank;
  }
  return candidate.eventId > current.eventId;
}
