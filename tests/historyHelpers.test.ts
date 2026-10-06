import { describe, expect, it } from "vitest";
import type { HistoryResponse, LibraryItem } from "../src/api/types";
import {
  buildFileTitleMap,
  findHistoryForFile,
  formatHistoryUpdatedAt,
  historyFileFallback,
  historyProgressPercent,
  isHistoryCompleted,
  resumePositionFromHistory,
  sortHistoryForContinue,
} from "../src/features/history/historyHelpers";

function makeHistory(
  overrides: Partial<HistoryResponse> = {},
): HistoryResponse {
  return {
    id: 1,
    task_file_id: 10,
    position_sec: 30,
    duration_sec: 100,
    completed: false,
    updated_at: "2026-03-05T21:14:00Z",
    ...overrides,
  };
}

describe("isHistoryCompleted / resumePositionFromHistory", () => {
  it("trusts the server completed flag", () => {
    expect(isHistoryCompleted(makeHistory({ completed: true }))).toBe(true);
  });

  it("applies the 95% local threshold when the flag is false", () => {
    expect(isHistoryCompleted(makeHistory({ position_sec: 96 }))).toBe(true);
    expect(isHistoryCompleted(makeHistory({ position_sec: 50 }))).toBe(false);
  });

  it("resumes from position_sec unless completed", () => {
    expect(resumePositionFromHistory(makeHistory({ position_sec: 42 }))).toBe(42);
    expect(
      resumePositionFromHistory(makeHistory({ completed: true, position_sec: 42 })),
    ).toBeNull();
    expect(resumePositionFromHistory(makeHistory({ position_sec: 99 }))).toBeNull();
    expect(resumePositionFromHistory(makeHistory({ position_sec: 0 }))).toBeNull();
    expect(resumePositionFromHistory(null)).toBeNull();
    expect(resumePositionFromHistory(undefined)).toBeNull();
  });
});

describe("findHistoryForFile / sortHistoryForContinue", () => {
  const list = [
    makeHistory({ id: 1, task_file_id: 10, updated_at: "2026-01-01" }),
    makeHistory({ id: 2, task_file_id: "abc", updated_at: "2026-02-01" }),
  ];

  it("matches task_file_id as strings", () => {
    expect(findHistoryForFile(list, 10)?.id).toBe(1);
    expect(findHistoryForFile(list, "10")?.id).toBe(1);
    expect(findHistoryForFile(list, "abc")?.id).toBe(2);
    expect(findHistoryForFile(list, 99)).toBeNull();
  });

  it("puts incomplete rows first and newest first", () => {
    const sorted = sortHistoryForContinue([
      makeHistory({ id: 1, completed: true, updated_at: "2026-03-01" }),
      makeHistory({ id: 2, completed: false, updated_at: "2026-01-01" }),
      makeHistory({ id: 3, completed: false, updated_at: "2026-02-01" }),
    ]);
    expect(sorted.map((h) => h.id)).toEqual([3, 2, 1]);
  });
});

describe("historyProgressPercent / fallback label", () => {
  it("computes a clamped 0–100 percentage", () => {
    expect(historyProgressPercent(makeHistory({ position_sec: 50, duration_sec: 100 }))).toBe(50);
    expect(historyProgressPercent(makeHistory({ position_sec: 0, duration_sec: 100 }))).toBe(0);
    expect(historyProgressPercent(makeHistory({ position_sec: 150, duration_sec: 100 }))).toBe(100);
    expect(historyProgressPercent(makeHistory({ position_sec: 50, duration_sec: 0 }))).toBe(0);
  });

  it("falls back to a file id label", () => {
    expect(historyFileFallback(12)).toBe("Файл #12");
    expect(historyFileFallback("abc")).toBe("Файл #abc");
  });
});

describe("buildFileTitleMap", () => {
  it("maps file ids to media title + episode label", () => {
    const item: LibraryItem = {
      library_item: { id: 1, status: "ready", created_at: "c" },
      media_item: {
        id: 2,
        title: "Сериал",
        poster_url: null,
        kp_type: "series",
        year: 2021,
      },
      files: [
        { id: 7, path: "a.mkv", size_bytes: 1, status: "ready", season: 1, episode: 3 },
        { id: 8, path: "b.mkv", size_bytes: 1, status: "ready" },
      ],
      total_size: 2,
      ready: true,
    };
    const map = buildFileTitleMap([item]);
    expect(map.get("7")).toBe("Сериал · Сезон 1 · Серия 3");
    expect(map.get("8")).toBe("Сериал");
    expect(map.has("9")).toBe(false);
  });
});

describe("formatHistoryUpdatedAt", () => {
  it("renders a Russian short timestamp", () => {
    const label = formatHistoryUpdatedAt("2026-03-05T21:14:00");
    expect(label).toMatch(/^\d{2}\.\d{2}\.\d{4}, \d{2}:\d{2}$/);
  });

  it("renders a dash for missing / invalid input", () => {
    expect(formatHistoryUpdatedAt("")).toBe("—");
    expect(formatHistoryUpdatedAt(null)).toBe("—");
    expect(formatHistoryUpdatedAt("not-a-date")).toBe("—");
  });
});
