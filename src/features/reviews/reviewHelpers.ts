/**
 * Pure review helpers (M4). No React/DOM — unit-testable.
 */

import type { ApiId, MediaDetail, ReviewResponse } from "../../api/types";

/** Inclusive bounds for a review score (Kinopoisk-style 1..10 integers). */
export const REVIEW_SCORE_MIN = 1;
export const REVIEW_SCORE_MAX = 10;

/**
 * True when `value` is an integer score in 1..10.
 * Accepts numeric strings that parse to a valid integer score.
 */
export function isValidReviewScore(value: unknown): boolean {
  let n: number;
  if (typeof value === "number") {
    n = value;
  } else if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "") return false;
    n = Number(trimmed);
  } else {
    return false;
  }
  return (
    Number.isInteger(n) && n >= REVIEW_SCORE_MIN && n <= REVIEW_SCORE_MAX
  );
}

/** Clamp any number into the 1..10 integer range (for display defaults). */
export function clampReviewScore(value: number): number {
  if (!Number.isFinite(value)) return REVIEW_SCORE_MIN;
  const rounded = Math.round(value);
  return Math.min(REVIEW_SCORE_MAX, Math.max(REVIEW_SCORE_MIN, rounded));
}

/** Optional review text: trimmed, empty string when absent. */
export function normalizeReviewText(raw: string | null | undefined): string {
  return typeof raw === "string" ? raw.trim() : "";
}

/** JSON body for PUT /api/media/{id}/review. */
export type ReviewWritePayload = {
  score: number;
  review?: string;
};

/**
 * Build a review write payload. Throws when the score is not a valid 1..10
 * integer so invalid values never reach the network layer.
 */
export function buildReviewPayload(
  score: unknown,
  reviewText?: string | null,
): ReviewWritePayload {
  if (!isValidReviewScore(score)) {
    throw new RangeError("Оценка должна быть целым числом от 1 до 10");
  }
  const n = typeof score === "number" ? score : Number(String(score).trim());
  const text = normalizeReviewText(reviewText);
  return text.length > 0 ? { score: n, review: text } : { score: n };
}

/**
 * Resolve the caller's own review for a media item.
 * Prefers `MediaDetail.user_review` when present; otherwise finds the review
 * whose user_id matches the authenticated user.
 */
export function resolveOwnReview(
  detail: Pick<MediaDetail, "user_review"> | null | undefined,
  reviews: readonly ReviewResponse[],
  userId: ApiId | null | undefined,
): ReviewResponse | null {
  if (detail?.user_review) return detail.user_review;
  if (userId === null || userId === undefined) return null;
  const key = String(userId);
  for (const review of reviews) {
    if (String(review.user_id) === key) return review;
  }
  return null;
}
