import { describe, expect, it } from "vitest";
import {
  filterReleases,
  RELEASE_DEFAULT_SORT,
  sortReleases,
} from "../src/features/releases/releaseHelpers";
import type { TorrentReleaseResponse } from "../src/api/types";

function makeRelease(
  overrides: Partial<TorrentReleaseResponse> = {},
): TorrentReleaseResponse {
  return {
    id: 1,
    tracker: "nnm",
    title: "Release",
    size_bytes: 1000,
    seeders: 1,
    leechers: 0,
    quality: "1080p",
    voiceover: "дубляж",
    magnet: "magnet:?xt=…",
    ...overrides,
  };
}

describe("sortReleases", () => {
  it("defaults to seeders descending", () => {
    expect(RELEASE_DEFAULT_SORT).toEqual({ key: "seeders", dir: "desc" });
    const list = [
      makeRelease({ id: 1, seeders: 5 }),
      makeRelease({ id: 2, seeders: 50 }),
      makeRelease({ id: 3, seeders: 20 }),
    ];
    expect(sortReleases(list).map((r) => r.id)).toEqual([2, 3, 1]);
  });

  it("sorts by size and title in both directions", () => {
    const list = [
      makeRelease({ id: 1, size_bytes: 300, title: "B" }),
      makeRelease({ id: 2, size_bytes: 100, title: "C" }),
      makeRelease({ id: 3, size_bytes: 200, title: "A" }),
    ];
    expect(sortReleases(list, "size", "asc").map((r) => r.id)).toEqual([2, 3, 1]);
    expect(sortReleases(list, "size", "desc").map((r) => r.id)).toEqual([1, 3, 2]);
    expect(sortReleases(list, "title", "asc").map((r) => r.id)).toEqual([3, 1, 2]);
    expect(sortReleases(list, "title", "desc").map((r) => r.id)).toEqual([2, 1, 3]);
  });

  it("does not mutate the input array", () => {
    const list = [makeRelease({ id: 1, seeders: 1 }), makeRelease({ id: 2, seeders: 9 })];
    const copy = [...list];
    sortReleases(list);
    expect(list).toEqual(copy);
  });
});

describe("filterReleases", () => {
  const list = [
    makeRelease({
      id: 1,
      tracker: "nnm-club",
      title: "Матрица 1999",
      quality: "1080p",
      voiceover: "дубляж",
    }),
    makeRelease({
      id: 2,
      tracker: "rutor",
      title: "The Matrix",
      quality: "4K",
      voiceover: "оригинал",
    }),
  ];

  it("returns everything for an empty query", () => {
    expect(filterReleases(list, "")).toHaveLength(2);
    expect(filterReleases(list, "   ")).toHaveLength(2);
  });

  it("matches tracker, title, quality and voiceover case-insensitively", () => {
    expect(filterReleases(list, "матрица").map((r) => r.id)).toEqual([1]);
    expect(filterReleases(list, "MATRIX").map((r) => r.id)).toEqual([2]);
    expect(filterReleases(list, "nnm").map((r) => r.id)).toEqual([1]);
    expect(filterReleases(list, "4K").map((r) => r.id)).toEqual([2]);
    expect(filterReleases(list, "дубляж").map((r) => r.id)).toEqual([1]);
  });

  it("returns empty when nothing matches", () => {
    expect(filterReleases(list, "нет такого")).toEqual([]);
  });
});
