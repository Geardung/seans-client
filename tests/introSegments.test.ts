import { describe, expect, it } from "vitest";
import {
  firstSegmentOfType,
  isSegmentActive,
  markerList,
  shouldShowCreditsPopup,
  skipTargetMs,
} from "../src/features/theintrodb/introSegments";
import {
  emptyBundle,
  segmentLabel,
  type TheIntroDbBundle,
  type TheIntroDbSegment,
} from "../src/features/theintrodb/types";
import {
  clearSegmentCache,
  fetchSegments,
  normalizeTheIntroDbBundle,
  peekSegmentCache,
  segmentCacheKey,
} from "../src/features/theintrodb/theintrodbApi";

function seg(
  startMs: number | null,
  endMs: number | null,
): TheIntroDbSegment {
  return { startMs, endMs };
}

function bundleWith(
  overrides: Partial<TheIntroDbBundle>,
): TheIntroDbBundle {
  return { ...emptyBundle(), ...overrides };
}

describe("isSegmentActive", () => {
  const intro = bundleWith({ intro: [seg(1000, 5000)] });

  it("is true inside [start, end)", () => {
    expect(isSegmentActive("intro", intro, 1000)).toBe(true);
    expect(isSegmentActive("intro", intro, 3000)).toBe(true);
    expect(isSegmentActive("intro", intro, 4999)).toBe(true);
  });

  it("is false outside the window (end exclusive)", () => {
    expect(isSegmentActive("intro", intro, 0)).toBe(false);
    expect(isSegmentActive("intro", intro, 999)).toBe(false);
    expect(isSegmentActive("intro", intro, 5000)).toBe(false);
    expect(isSegmentActive("intro", intro, 9000)).toBe(false);
  });

  it("null start_ms counts as file start (0)", () => {
    const recap = bundleWith({ recap: [seg(null, 2000)] });
    expect(isSegmentActive("recap", recap, 0)).toBe(true);
    expect(isSegmentActive("recap", recap, 1999)).toBe(true);
    expect(isSegmentActive("recap", recap, 2000)).toBe(false);
  });

  it("null end_ms runs to EOF (+inf)", () => {
    const credits = bundleWith({ credits: [seg(8000, null)] });
    expect(isSegmentActive("credits", credits, 8000)).toBe(true);
    expect(isSegmentActive("credits", credits, 10_000_000)).toBe(true);
  });

  it("accepts a plain segment list", () => {
    expect(isSegmentActive("preview", [seg(0, 100)], 50)).toBe(true);
    expect(isSegmentActive("preview", [seg(0, 100)], 100)).toBe(false);
  });

  it("is false for empty / missing lists and other types", () => {
    expect(isSegmentActive("intro", emptyBundle(), 0)).toBe(false);
    expect(isSegmentActive("intro", null, 0)).toBe(false);
    expect(isSegmentActive("recap", intro, 3000)).toBe(false);
  });
});

describe("skipTargetMs", () => {
  it("returns end_ms + 300ms", () => {
    expect(skipTargetMs(seg(1000, 5000))).toBe(5300);
    expect(skipTargetMs(seg(null, 0))).toBe(300);
    expect(skipTargetMs(seg(0, 99))).toBe(399);
  });

  it("returns null when end is missing (open-ended)", () => {
    expect(skipTargetMs(seg(1000, null))).toBeNull();
    expect(skipTargetMs(null)).toBeNull();
    expect(skipTargetMs(undefined)).toBeNull();
    expect(skipTargetMs(seg(0, Number.NaN))).toBeNull();
  });
});

describe("shouldShowCreditsPopup", () => {
  const credits = [seg(8000, null)];

  it("opens at or after credits[0].start_ms", () => {
    expect(
      shouldShowCreditsPopup(credits, 8000, {
        shown: false,
        alreadyReviewed: false,
      }),
    ).toBe(true);
    expect(
      shouldShowCreditsPopup(credits, 12_000, {
        shown: false,
        alreadyReviewed: false,
      }),
    ).toBe(true);
  });

  it("stays closed before the credits window", () => {
    expect(
      shouldShowCreditsPopup(credits, 7999, {
        shown: false,
        alreadyReviewed: false,
      }),
    ).toBe(false);
    expect(
      shouldShowCreditsPopup(credits, 0, {
        shown: false,
        alreadyReviewed: false,
      }),
    ).toBe(false);
  });

  it("gates on already-shown (once per session) and already-reviewed", () => {
    expect(
      shouldShowCreditsPopup(credits, 9000, {
        shown: true,
        alreadyReviewed: false,
      }),
    ).toBe(false);
    expect(
      shouldShowCreditsPopup(credits, 9000, {
        shown: false,
        alreadyReviewed: true,
      }),
    ).toBe(false);
    expect(
      shouldShowCreditsPopup(credits, 9000, {
        shown: true,
        alreadyReviewed: true,
      }),
    ).toBe(false);
  });

  it("stays closed without credits segments", () => {
    expect(
      shouldShowCreditsPopup([], 9000, {
        shown: false,
        alreadyReviewed: false,
      }),
    ).toBe(false);
    expect(
      shouldShowCreditsPopup(null, 9000, {
        shown: false,
        alreadyReviewed: false,
      }),
    ).toBe(false);
  });

  it("null start_ms counts as 0", () => {
    expect(
      shouldShowCreditsPopup([seg(null, null)], 0, {
        shown: false,
        alreadyReviewed: false,
      }),
    ).toBe(true);
  });
});

describe("markerList", () => {
  it("flattens all types and sorts by startMs", () => {
    const bundle = bundleWith({
      intro: [seg(1000, 5000)],
      recap: [seg(0, 800)],
      credits: [seg(9000, null)],
      preview: [seg(2000, 2500)],
    });
    const markers = markerList(bundle);
    expect(markers.map((m) => m.type)).toEqual([
      "recap",
      "intro",
      "preview",
      "credits",
    ]);
    expect(markers.map((m) => m.startMs)).toEqual([0, 1000, 2000, 9000]);
  });

  it("resolves null startMs to 0 and keeps null endMs", () => {
    const markers = markerList(bundleWith({ credits: [seg(null, null)] }));
    expect(markers).toHaveLength(1);
    expect(markers[0].startMs).toBe(0);
    expect(markers[0].endMs).toBeNull();
    expect(markers[0].label).toBe("Титры");
  });

  it("breaks start ties by type name for stability", () => {
    const markers = markerList(
      bundleWith({
        intro: [seg(1000, 2000)],
        preview: [seg(1000, 3000)],
      }),
    );
    expect(markers.map((m) => m.type)).toEqual(["intro", "preview"]);
  });

  it("returns empty for empty / missing bundle", () => {
    expect(markerList(emptyBundle())).toEqual([]);
    expect(markerList(null)).toEqual([]);
    expect(markerList(undefined)).toEqual([]);
  });
});

describe("segment labels", () => {
  it("are Russian", () => {
    expect(segmentLabel("intro")).toBe("Интро");
    expect(segmentLabel("recap")).toBe("Recap");
    expect(segmentLabel("credits")).toBe("Титры");
    expect(segmentLabel("preview")).toBe("Превью");
  });
});

describe("firstSegmentOfType", () => {
  it("returns the first segment or null", () => {
    const b = bundleWith({ intro: [seg(1, 2), seg(3, 4)] });
    expect(firstSegmentOfType("intro", b)).toEqual(seg(1, 2));
    expect(firstSegmentOfType("recap", b)).toBeNull();
    expect(firstSegmentOfType("intro", null)).toBeNull();
  });
});

describe("segmentCacheKey", () => {
  it("uses `${tmdbId}:s:e` with empty parts when missing", () => {
    expect(segmentCacheKey(603, 1, 2)).toBe("603:1:2");
    expect(segmentCacheKey(603)).toBe("603::");
    expect(segmentCacheKey(603, null, null)).toBe("603::");
    expect(segmentCacheKey(603, 2, null)).toBe("603:2:");
    expect(segmentCacheKey(603, null, 5)).toBe("603::5");
    expect(segmentCacheKey(0, 1, 1)).toBe("0:1:1");
  });
});

describe("normalizeTheIntroDbBundle", () => {
  it("coerces start_ms / end_ms via toNumber and keeps nulls", () => {
    const bundle = normalizeTheIntroDbBundle({
      intro: [{ start_ms: "1000", end_ms: 5000 }],
      recap: [{ start_ms: null, end_ms: "250" }],
      credits: [{ start_ms: 8000, end_ms: null }],
      preview: [],
    });
    expect(bundle.intro).toEqual([{ startMs: 1000, endMs: 5000 }]);
    expect(bundle.recap).toEqual([{ startMs: null, endMs: 250 }]);
    expect(bundle.credits).toEqual([{ startMs: 8000, endMs: null }]);
    expect(bundle.preview).toEqual([]);
  });

  it("accepts a nested `segments` object and missing keys", () => {
    const bundle = normalizeTheIntroDbBundle({
      segments: {
        intro: [{ start_ms: 0, end_ms: 10 }],
      },
    });
    expect(bundle.intro).toEqual([{ startMs: 0, endMs: 10 }]);
    expect(bundle.recap).toEqual([]);
    expect(bundle.credits).toEqual([]);
    expect(bundle.preview).toEqual([]);
  });

  it("ignores non-array / garbage entries", () => {
    const bundle = normalizeTheIntroDbBundle({
      intro: "nope",
      recap: [null, { start_ms: "x", end_ms: "y" }],
    });
    expect(bundle.intro).toEqual([]);
    // null and invalid ms both normalize to {startMs: null, endMs: null}
    expect(bundle.recap).toEqual([
      { startMs: null, endMs: null },
      { startMs: null, endMs: null },
    ]);
  });
});

describe("segment cache lifecycle", () => {
  it("clearSegmentCache drops entries", () => {
    clearSegmentCache();
    expect(segmentCacheKey(1, 1, 1)).toBe("1:1:1");
  });

  it("fetchSegments caches by key and reuses the in-memory result", async () => {
    clearSegmentCache();
    const payload = {
      intro: [{ start_ms: 0, end_ms: 1000 }],
      recap: [],
      credits: [{ start_ms: 9000, end_ms: null }],
      preview: [],
    };
    let calls = 0;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      calls += 1;
      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    try {
      const first = await fetchSegments({ tmdbId: 42, season: 1, episode: 2 });
      expect(first.intro).toEqual([{ startMs: 0, endMs: 1000 }]);
      expect(calls).toBe(1);

      const second = await fetchSegments({ tmdbId: 42, season: 1, episode: 2 });
      expect(second).toBe(first);
      expect(calls).toBe(1);

      // Different cache key → new request.
      await fetchSegments({ tmdbId: 42, season: 1, episode: 3 });
      expect(calls).toBe(2);

      expect(peekSegmentCache(42, 1, 2)).toBe(first);
      clearSegmentCache();
      expect(peekSegmentCache(42, 1, 2)).toBeUndefined();
    } finally {
      globalThis.fetch = originalFetch;
      clearSegmentCache();
    }
  });

  it("fetchSegments returns an empty bundle on network failure (silent-off)", async () => {
    clearSegmentCache();
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      throw new Error("offline");
    }) as typeof fetch;

    try {
      const bundle = await fetchSegments({ tmdbId: 7 });
      expect(bundle).toEqual(emptyBundle());
    } finally {
      globalThis.fetch = originalFetch;
      clearSegmentCache();
    }
  });

  it("fetchSegments short-circuits non-positive tmdb ids", async () => {
    clearSegmentCache();
    const originalFetch = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = (async () => {
      calls += 1;
      return new Response("{}", { status: 200 });
    }) as typeof fetch;

    try {
      expect(await fetchSegments({ tmdbId: 0 })).toEqual(emptyBundle());
      expect(await fetchSegments({ tmdbId: -1 })).toEqual(emptyBundle());
      expect(calls).toBe(0);
    } finally {
      globalThis.fetch = originalFetch;
      clearSegmentCache();
    }
  });
});
