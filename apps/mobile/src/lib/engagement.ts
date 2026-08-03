import {
  deleteLocalValue,
  getLocalValue,
  setLocalValue,
} from "./localStorage";

const engagementStateKey = "murmur_engagement_v1";
const qualifiedSessionsBeforeReview = 3;
const reviewIntervalMs = 180 * 24 * 60 * 60 * 1000;

type EngagementState = {
  last_review_request_at_ms: number | null;
  qualified_session_count: number;
  review_requested_for_version: string | null;
};

export type SessionOutcome = {
  committed_caption_count: number;
  duration_ms: number;
  error: string | null;
};

export type EngagementResult = {
  qualified: boolean;
  qualified_session_count: number;
  should_request_review: boolean;
};

export function isQualifiedSession(outcome: SessionOutcome): boolean {
  if (outcome.error || outcome.committed_caption_count < 1) {
    return false;
  }
  return outcome.duration_ms >= 60_000 || outcome.committed_caption_count >= 2;
}

export async function recordSessionOutcome(params: {
  app_version: string;
  now_ms?: number;
  outcome: SessionOutcome;
}): Promise<EngagementResult> {
  const current = await readEngagementState();
  if (!isQualifiedSession(params.outcome)) {
    return {
      qualified: false,
      qualified_session_count: current.qualified_session_count,
      should_request_review: false,
    };
  }

  const nowMs = params.now_ms ?? Date.now();
  const qualifiedSessionCount = current.qualified_session_count + 1;
  const shouldRequestReview =
    qualifiedSessionCount >= qualifiedSessionsBeforeReview &&
    current.review_requested_for_version !== params.app_version &&
    (
      current.last_review_request_at_ms === null ||
      nowMs - current.last_review_request_at_ms >= reviewIntervalMs
    );
  const next: EngagementState = {
    last_review_request_at_ms: current.last_review_request_at_ms,
    qualified_session_count: qualifiedSessionCount,
    review_requested_for_version: current.review_requested_for_version,
  };
  await setLocalValue(engagementStateKey, JSON.stringify(next));

  return {
    qualified: true,
    qualified_session_count: qualifiedSessionCount,
    should_request_review: shouldRequestReview,
  };
}

export async function markReviewRequested(params: {
  app_version: string;
  now_ms?: number;
}): Promise<void> {
  const current = await readEngagementState();
  await setLocalValue(engagementStateKey, JSON.stringify({
    ...current,
    last_review_request_at_ms: params.now_ms ?? Date.now(),
    review_requested_for_version: params.app_version,
  } satisfies EngagementState));
}

export async function deleteEngagementState(): Promise<void> {
  await deleteLocalValue(engagementStateKey);
}

async function readEngagementState(): Promise<EngagementState> {
  const stored = await getLocalValue(engagementStateKey);
  if (!stored) {
    return emptyEngagementState();
  }

  const parsed = parseStoredState(stored);
  return parsed ?? emptyEngagementState();
}

function parseStoredState(stored: string): EngagementState | null {
  try {
    const value = JSON.parse(stored) as Record<string, unknown>;
    if (
      typeof value.qualified_session_count !== "number" ||
      !Number.isInteger(value.qualified_session_count) ||
      value.qualified_session_count < 0
    ) {
      return null;
    }
    return {
      last_review_request_at_ms:
        typeof value.last_review_request_at_ms === "number"
          ? value.last_review_request_at_ms
          : null,
      qualified_session_count: value.qualified_session_count,
      review_requested_for_version:
        typeof value.review_requested_for_version === "string"
          ? value.review_requested_for_version
          : null,
    };
  } catch {
    return null;
  }
}

function emptyEngagementState(): EngagementState {
  return {
    last_review_request_at_ms: null,
    qualified_session_count: 0,
    review_requested_for_version: null,
  };
}
