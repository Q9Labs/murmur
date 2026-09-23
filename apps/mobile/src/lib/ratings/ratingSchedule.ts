export { insightSettings as ratingSettings } from "@murmur/protocol/insights";
export type { InsightSetting as RatingSetting } from "@murmur/protocol/insights";

export function shouldShowRating(successfulSessionCount: number): boolean {
  return successfulSessionCount === 1 ||
    successfulSessionCount === 2 ||
    (successfulSessionCount >= 5 && (successfulSessionCount - 5) % 3 === 0);
}

export function isSuccessfulSession(completion: {
  committed_caption_count: number;
  duration_ms: number;
  error: string | null;
}): boolean {
  return completion.duration_ms >= 60_000 &&
    completion.error === null;
}

export function shouldRequestStoreReview(
  platform: string,
  successfulSessionCount: number,
  stars: number | null,
  alreadyRequested: boolean,
): boolean {
  if (platform === "android") return successfulSessionCount === 3 && !alreadyRequested;
  if (platform === "ios") return !alreadyRequested &&
    ((stars !== null && stars >= 4) || successfulSessionCount === 3);
  return false;
}
