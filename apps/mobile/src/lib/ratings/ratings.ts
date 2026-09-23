import * as Sentry from "@sentry/react-native";
import * as StoreReview from "expo-store-review";
import { Platform } from "react-native";

import { deleteLocalValue, getLocalValue, setLocalValue } from "../localStorage";
import { getOrCreateInstallId } from "../installIdentity";
import { deliverRatingSurvey } from "../providers/insightsWorker";
import { captureMobileTelemetry } from "../telemetry";
import {
  isSuccessfulSession,
  ratingSettings,
  shouldRequestStoreReview,
  shouldShowRating,
  type RatingSetting,
} from "./ratingSchedule";

const stateKey = "murmur_rating_state_v2";

type RatingState = {
  completedSessionCount: number;
  ratingEligibleSessionCount: number;
  successfulSessionCount: number;
  storeReviewRequested: boolean;
};

export type SessionRatingDecision = {
  askInsightsConsent: boolean;
  ratingEligible: boolean;
  successfulSessionCount: number;
};

let pending = Promise.resolve();

async function readState(): Promise<RatingState> {
  const stored = await getLocalValue(stateKey);
  if (!stored) {
    return { completedSessionCount: 0, ratingEligibleSessionCount: 0, successfulSessionCount: 0, storeReviewRequested: false };
  }
  const value: unknown = JSON.parse(stored);
  if (!isRatingState(value)) throw new Error("rating_state_invalid");
  return value;
}

const ratingCountKeys = ["completedSessionCount", "ratingEligibleSessionCount", "successfulSessionCount"] as const;

function isRatingState(value: unknown): value is RatingState {
  return typeof value === "object" && value !== null &&
    ratingCountKeys.every((key) => Number.isInteger(Reflect.get(value, key))) &&
    typeof Reflect.get(value, "storeReviewRequested") === "boolean";
}

async function writeState(state: RatingState): Promise<void> {
  await setLocalValue(stateKey, JSON.stringify(state));
}

function serialized<T>(operation: () => Promise<T>): Promise<T> {
  const result = pending.then(operation);
  pending = result.then(() => undefined, () => undefined);
  return result;
}

export function recordCompletedSession(completion: {
  committed_caption_count: number;
  duration_ms: number;
  error: string | null;
}): Promise<SessionRatingDecision> {
  return serialized(async () => {
    const state = await readState();
    const completedSessionCount = state.completedSessionCount + Number(completion.error === null);
    if (!isSuccessfulSession(completion)) {
      if (completedSessionCount !== state.completedSessionCount) {
        await writeState({ ...state, completedSessionCount });
      }
      return {
        askInsightsConsent: completedSessionCount === 1 && state.completedSessionCount === 0,
        ratingEligible: false,
        successfulSessionCount: state.successfulSessionCount,
      };
    }
    const next = { ...state, completedSessionCount, successfulSessionCount: state.successfulSessionCount + 1 };
    await writeState(next);
    if (shouldRequestStoreReview(Platform.OS, next.successfulSessionCount, null, next.storeReviewRequested)) {
      await requestStoreReview(next);
    }
    return {
      askInsightsConsent: next.completedSessionCount === 1,
      ratingEligible: true,
      successfulSessionCount: next.successfulSessionCount,
    };
  });
}

// Called only when a rating-eligible session wasn't taken by a more important prompt,
// so the schedule counts the sessions where the rating could actually be shown.
export function claimRatingSlot(): Promise<boolean> {
  return serialized(async () => {
    const state = await readState();
    const ratingEligibleSessionCount = state.ratingEligibleSessionCount + 1;
    await writeState({ ...state, ratingEligibleSessionCount });
    return shouldShowRating(ratingEligibleSessionCount);
  });
}

export function submitRating(params: {
  answer: RatingSetting;
  otherText?: string;
  stars: 1 | 2 | 3 | 4 | 5;
}): Promise<void> {
  return serialized(async () => {
    if (!ratingSettings.some((setting) => setting === params.answer)) {
      throw new Error("rating_answer_invalid");
    }
    if (params.otherText && params.answer !== "other") {
      throw new Error("rating_other_text_without_other_answer");
    }
    if (params.otherText && params.otherText.length > 500) {
      throw new Error("rating_other_text_too_long");
    }
    const state = await readState();
    if (shouldRequestStoreReview(Platform.OS, state.successfulSessionCount, params.stars, state.storeReviewRequested)) {
      await requestStoreReview(state);
    }
    const appInstallId = await getOrCreateInstallId();
    await deliverRatingSurvey({
      app_install_id: appInstallId,
      answer: params.answer,
      other_text: params.otherText,
      stars: params.stars,
    });
  });
}

export async function deleteRatingState(): Promise<void> {
  await deleteLocalValue(stateKey);
}

async function requestStoreReview(state: RatingState): Promise<void> {
  try {
    if (!(await StoreReview.isAvailableAsync())) return;
    await StoreReview.requestReview();
    await writeState({ ...state, storeReviewRequested: true });
    captureMobileTelemetry({ event: "store_review_prompted", platform: Platform.OS === "ios" ? "ios" : "android" });
  } catch (failure) {
    Sentry.captureException(failure, { tags: { operation: "request_store_review" } });
  }
}
