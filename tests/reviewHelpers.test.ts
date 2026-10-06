import { describe, expect, it } from "vitest";
import {
  buildReviewPayload,
  clampReviewScore,
  isValidReviewScore,
  normalizeReviewText,
  resolveOwnReview,
  REVIEW_SCORE_MAX,
  REVIEW_SCORE_MIN,
} from "../src/features/reviews/reviewHelpers";
import type { MediaDetail, ReviewResponse } from "../src/api/types";

function makeReview(overrides: Partial<ReviewResponse> = {}): ReviewResponse {
  return {
    id: 1,
    user_id: 7,
    media_item_id: 2,
    score: 8,
    review: "Хорошо",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-02T00:00:00Z",
    ...overrides,
  };
}

describe("isValidReviewScore", () => {
  it("accepts integers in 1..10", () => {
    expect(REVIEW_SCORE_MIN).toBe(1);
    expect(REVIEW_SCORE_MAX).toBe(10);
    for (let n = 1; n <= 10; n += 1) {
      expect(isValidReviewScore(n)).toBe(true);
    }
  });

  it("rejects out-of-range numbers", () => {
    expect(isValidReviewScore(0)).toBe(false);
    expect(isValidReviewScore(11)).toBe(false);
    expect(isValidReviewScore(-1)).toBe(false);
  });

  it("rejects non-integers and non-finite numbers", () => {
    expect(isValidReviewScore(7.5)).toBe(false);
    expect(isValidReviewScore(Number.NaN)).toBe(false);
    expect(isValidReviewScore(Number.POSITIVE_INFINITY)).toBe(false);
  });

  it("accepts numeric strings that parse to a valid integer score", () => {
    expect(isValidReviewScore("1")).toBe(true);
    expect(isValidReviewScore(" 10 ")).toBe(true);
  });

  it("rejects invalid strings and other types", () => {
    expect(isValidReviewScore("")).toBe(false);
    expect(isValidReviewScore("abc")).toBe(false);
    expect(isValidReviewScore("11")).toBe(false);
    expect(isValidReviewScore("7.5")).toBe(false);
    expect(isValidReviewScore(null)).toBe(false);
    expect(isValidReviewScore(undefined)).toBe(false);
    expect(isValidReviewScore(true)).toBe(false);
    expect(isValidReviewScore({})).toBe(false);
  });
});

describe("clampReviewScore", () => {
  it("clamps into 1..10 and rounds", () => {
    expect(clampReviewScore(0)).toBe(1);
    expect(clampReviewScore(11)).toBe(10);
    expect(clampReviewScore(7.4)).toBe(7);
    expect(clampReviewScore(7.6)).toBe(8);
    expect(clampReviewScore(Number.NaN)).toBe(1);
    expect(clampReviewScore(5)).toBe(5);
  });
});

describe("normalizeReviewText", () => {
  it("trims text and maps absent values to empty string", () => {
    expect(normalizeReviewText("  отлично  ")).toBe("отлично");
    expect(normalizeReviewText("")).toBe("");
    expect(normalizeReviewText(null)).toBe("");
    expect(normalizeReviewText(undefined)).toBe("");
  });
});

describe("buildReviewPayload", () => {
  it("builds a score-only payload when review text is empty", () => {
    expect(buildReviewPayload(7, "")).toEqual({ score: 7 });
    expect(buildReviewPayload(7, "   ")).toEqual({ score: 7 });
    expect(buildReviewPayload(7)).toEqual({ score: 7 });
    expect(buildReviewPayload(7, null)).toEqual({ score: 7 });
  });

  it("includes trimmed review text when present", () => {
    expect(buildReviewPayload(9, "  шедевр  ")).toEqual({
      score: 9,
      review: "шедевр",
    });
  });

  it("accepts numeric-string scores", () => {
    expect(buildReviewPayload(" 8 ", "ok")).toEqual({ score: 8, review: "ok" });
  });

  it("throws on invalid scores so they never reach the API", () => {
    expect(() => buildReviewPayload(0)).toThrow(RangeError);
    expect(() => buildReviewPayload(11)).toThrow(RangeError);
    expect(() => buildReviewPayload(7.5)).toThrow(RangeError);
    expect(() => buildReviewPayload("abc")).toThrow(RangeError);
    expect(() => buildReviewPayload(null)).toThrow(RangeError);
  });
});

describe("resolveOwnReview", () => {
  const detailWithUserReview = {
    user_review: makeReview({ id: 100, user_id: 7, score: 9 }),
  } as Pick<MediaDetail, "user_review">;

  it("prefers MediaDetail.user_review when present", () => {
    const reviews = [makeReview({ id: 1, user_id: 7, score: 3 })];
    const own = resolveOwnReview(detailWithUserReview, reviews, 7);
    expect(own?.id).toBe(100);
    expect(own?.score).toBe(9);
  });

  it("falls back to the review whose user_id matches", () => {
    const reviews = [
      makeReview({ id: 1, user_id: 1 }),
      makeReview({ id: 2, user_id: 7, score: 4 }),
      makeReview({ id: 3, user_id: 9 }),
    ];
    const own = resolveOwnReview({ user_review: undefined }, reviews, 7);
    expect(own?.id).toBe(2);
    expect(own?.score).toBe(4);
  });

  it("matches user ids across number/string representation", () => {
    const reviews = [makeReview({ id: 5, user_id: "7" })];
    expect(resolveOwnReview(null, reviews, 7)?.id).toBe(5);
    expect(resolveOwnReview(null, reviews, "7")?.id).toBe(5);
  });

  it("returns null when there is no own review or no user", () => {
    const reviews = [makeReview({ id: 1, user_id: 1 })];
    expect(resolveOwnReview(null, reviews, 7)).toBeNull();
    expect(resolveOwnReview(null, reviews, null)).toBeNull();
    expect(resolveOwnReview(null, reviews, undefined)).toBeNull();
    expect(resolveOwnReview({ user_review: undefined }, [], 7)).toBeNull();
  });
});
