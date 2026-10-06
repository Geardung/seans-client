import { describe, expect, it } from "vitest";
import {
  normalizeMediaDetail,
  normalizeReviewList,
  normalizeSearchResults,
} from "../src/api/parsing";

const baseDetail = {
  id: 2,
  kp_id: 302,
  title: "Фильм",
  year: 2020,
  poster_url: null,
  kp_type: "film",
  rating_kp: 6,
  original_title: "Film",
  overview: "Описание",
  genres: ["драма"],
  updated_at: "2026-02-01T00:00:00Z",
};

describe("normalizeMediaDetail — genres array", () => {
  it("keeps a string genres array as-is", () => {
    const detail = normalizeMediaDetail({ ...baseDetail, genres: ["драма", "триллер"] });
    expect(detail.genres).toEqual(["драма", "триллер"]);
  });

  it("coerces non-string genre entries via String()", () => {
    const detail = normalizeMediaDetail({ ...baseDetail, genres: ["драма", 123] });
    expect(detail.genres).toEqual(["драма", "123"]);
  });

  it("falls back to [] when genres is missing or not an array", () => {
    expect(normalizeMediaDetail({ ...baseDetail, genres: undefined }).genres).toEqual([]);
    expect(normalizeMediaDetail({ ...baseDetail, genres: null }).genres).toEqual([]);
    expect(normalizeMediaDetail({ ...baseDetail, genres: "драма" }).genres).toEqual([]);
    const withoutGenres: Record<string, unknown> = { ...baseDetail };
    delete withoutGenres.genres;
    expect(normalizeMediaDetail(withoutGenres).genres).toEqual([]);
  });
});

describe("normalizeMediaDetail — optional user_review", () => {
  it("omits user_review when the field is absent or null", () => {
    const absent = normalizeMediaDetail(baseDetail);
    expect(absent.user_review).toBeUndefined();
    const explicitNull = normalizeMediaDetail({ ...baseDetail, user_review: null });
    expect(explicitNull.user_review).toBeUndefined();
  });

  it("normalizes a present user_review payload", () => {
    const detail = normalizeMediaDetail({
      ...baseDetail,
      user_review: {
        id: 9,
        user_id: 7,
        media_item_id: 2,
        score: "8",
        review: "Хорошо",
        created_at: "c",
        updated_at: "u",
      },
    });
    expect(detail.user_review).toBeDefined();
    expect(detail.user_review?.score).toBe(8);
    expect(detail.user_review?.review).toBe("Хорошо");
    expect(detail.user_review?.user_id).toBe(7);
  });

  it("coerces rating_kp and year strings on the detail", () => {
    const detail = normalizeMediaDetail({
      ...baseDetail,
      year: "2021",
      rating_kp: "7.2",
    });
    expect(detail.year).toBe(2021);
    expect(detail.rating_kp).toBe(7.2);
  });
});

describe("normalizeSearchResults", () => {
  it("maps an array payload to typed MediaSearchResult items", () => {
    const results = normalizeSearchResults([
      {
        id: "m1",
        kp_id: 1,
        title: "A",
        year: "2000",
        poster_url: null,
        kp_type: "film",
        rating_kp: "5.5",
      },
      {
        id: 2,
        kp_id: 2,
        title: "B",
        year: 2001,
        poster_url: "p",
        kp_type: "series",
        rating_kp: null,
      },
    ]);
    expect(results).toHaveLength(2);
    expect(results[0].id).toBe("m1");
    expect(results[0].year).toBe(2000);
    expect(results[0].rating_kp).toBe(5.5);
    expect(results[1].rating_kp).toBeNull();
  });

  it("returns [] for non-array payloads", () => {
    expect(normalizeSearchResults(null)).toEqual([]);
    expect(normalizeSearchResults(undefined)).toEqual([]);
    expect(normalizeSearchResults({ items: [] })).toEqual([]);
    expect(normalizeSearchResults("nope")).toEqual([]);
  });
});

describe("normalizeReviewList", () => {
  it("maps an array payload to typed ReviewResponse items", () => {
    const reviews = normalizeReviewList([
      {
        id: 1,
        user_id: "7",
        media_item_id: 2,
        score: "9",
        review: " ok ",
        created_at: "c",
        updated_at: "u",
      },
    ]);
    expect(reviews).toHaveLength(1);
    expect(reviews[0].user_id).toBe("7");
    expect(reviews[0].score).toBe(9);
    expect(reviews[0].review).toBe(" ok ");
  });

  it("returns [] for non-array payloads", () => {
    expect(normalizeReviewList(null)).toEqual([]);
    expect(normalizeReviewList({ reviews: [] })).toEqual([]);
    expect(normalizeReviewList(42)).toEqual([]);
  });
});
