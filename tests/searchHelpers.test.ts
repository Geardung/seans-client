import { describe, expect, it } from "vitest";
import {
  isSearchQueryReady,
  normalizeSearchQuery,
  searchRequestFor,
  SEARCH_DEBOUNCE_MS,
  SEARCH_MIN_QUERY_LENGTH,
} from "../src/features/search/searchHelpers";

describe("normalizeSearchQuery", () => {
  it("trims leading and trailing whitespace", () => {
    expect(normalizeSearchQuery("  матрица  ")).toBe("матрица");
  });

  it("collapses internal whitespace runs to a single space", () => {
    expect(normalizeSearchQuery("the   lord \t of\n rings")).toBe(
      "the lord of rings",
    );
  });

  it("returns empty string for blank input", () => {
    expect(normalizeSearchQuery("")).toBe("");
    expect(normalizeSearchQuery("   \t\n ")).toBe("");
  });
});

describe("isSearchQueryReady", () => {
  it("uses the 250ms debounce constant", () => {
    expect(SEARCH_DEBOUNCE_MS).toBe(250);
    expect(SEARCH_MIN_QUERY_LENGTH).toBe(2);
  });

  it("rejects empty and single-character queries", () => {
    expect(isSearchQueryReady("")).toBe(false);
    expect(isSearchQueryReady(" ")).toBe(false);
    expect(isSearchQueryReady("а")).toBe(false);
  });

  it("accepts queries of at least 2 normalized characters", () => {
    expect(isSearchQueryReady("ит")).toBe(true);
    expect(isSearchQueryReady("  ит  ")).toBe(true);
    expect(isSearchQueryReady("матрица")).toBe(true);
  });
});

describe("searchRequestFor", () => {
  it("returns null when the query is too short", () => {
    expect(searchRequestFor("")).toBeNull();
    expect(searchRequestFor(" x ")).toBeNull();
    expect(searchRequestFor("   ")).toBeNull();
  });

  it("returns the normalized q for ready queries", () => {
    expect(searchRequestFor("  дюна  ")).toEqual({ q: "дюна" });
    expect(searchRequestFor("the   matrix")).toEqual({ q: "the matrix" });
    expect(searchRequestFor("ит")).toEqual({ q: "ит" });
  });
});
