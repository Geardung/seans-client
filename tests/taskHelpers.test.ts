import { describe, expect, it } from "vitest";
import {
  buildTaskCreateBody,
  formatTaskStatus,
  hasLostActive,
  isTaskActive,
  mergeActiveTasks,
  taskPollInterval,
  TASK_POLL_ACTIVE_MS,
} from "../src/features/tasks/taskHelpers";
import type { TaskDetailResponse } from "../src/api/types";

function makeTask(
  overrides: Partial<TaskDetailResponse> = {},
): TaskDetailResponse {
  return {
    id: 1,
    status: "running",
    reserved_bytes: 0,
    progress_pct: 0,
    speed_bps: 0,
    stage: "download",
    created_at: "c",
    updated_at: "u",
    ...overrides,
  };
}

describe("isTaskActive", () => {
  it("treats known terminal statuses as inactive (case-insensitive)", () => {
    for (const status of [
      "completed",
      "Completed",
      "finished",
      "done",
      "failed",
      "error",
      "cancelled",
      "canceled",
      "idle",
    ]) {
      expect(isTaskActive(status)).toBe(false);
    }
  });

  it("treats in-flight and unknown statuses as active", () => {
    for (const status of ["running", "queued", "downloading", "processing", "paused", ""]) {
      expect(isTaskActive(status)).toBe(true);
    }
  });

  it("handles nullish status defensively", () => {
    expect(isTaskActive(undefined as unknown as string)).toBe(true);
    expect(isTaskActive(null as unknown as string)).toBe(true);
  });
});

describe("taskPollInterval", () => {
  it("returns the 3s interval while any task is active", () => {
    expect(taskPollInterval([])).toBeNull();
    expect(taskPollInterval([makeTask({ status: "completed" })])).toBeNull();
    expect(
      taskPollInterval([
        makeTask({ id: 1, status: "failed" }),
        makeTask({ id: 2, status: "running" }),
      ]),
    ).toBe(TASK_POLL_ACTIVE_MS);
    expect(TASK_POLL_ACTIVE_MS).toBe(3000);
  });

  it("stops when every task is terminal", () => {
    expect(
      taskPollInterval([
        makeTask({ id: 1, status: "completed" }),
        makeTask({ id: 2, status: "cancelled" }),
      ]),
    ).toBeNull();
  });
});

describe("buildTaskCreateBody", () => {
  it("uses the release file_paths as the default full selection", () => {
    const body = buildTaskCreateBody({
      id: "r1",
      file_paths: ["a.mkv", "b.mkv"],
    });
    expect(body).toEqual({
      torrent_release_id: "r1",
      file_paths: ["a.mkv", "b.mkv"],
    });
  });

  it("sends empty file_paths[] as full-torrent selection when the API lists none", () => {
    const body = buildTaskCreateBody({ id: 9 });
    expect(body).toEqual({ torrent_release_id: 9, file_paths: [] });

    const withEmptyList = buildTaskCreateBody({ id: 9, file_paths: [] });
    expect(withEmptyList.file_paths).toEqual([]);
  });

  it("prefers an explicit user selection", () => {
    const body = buildTaskCreateBody(
      { id: 2, file_paths: ["a.mkv", "b.mkv"] },
      ["b.mkv"],
    );
    expect(body.file_paths).toEqual(["b.mkv"]);
  });
});

describe("mergeActiveTasks / hasLostActive", () => {
  it("upserts active tasks and keeps finished ones", () => {
    const prev = [
      makeTask({ id: 1, status: "running", progress_pct: 10 }),
      makeTask({ id: 2, status: "completed", progress_pct: 100 }),
    ];
    const active = [makeTask({ id: 1, status: "running", progress_pct: 55 })];
    const merged = mergeActiveTasks(prev, active);
    expect(merged).toHaveLength(2);
    expect(merged.find((t) => t.id === 1)?.progress_pct).toBe(55);
    expect(merged.find((t) => t.id === 2)?.status).toBe("completed");
  });

  it("adds tasks that were not known before", () => {
    const merged = mergeActiveTasks([], [makeTask({ id: 7, status: "queued" })]);
    expect(merged.map((t) => t.id)).toEqual([7]);
  });

  it("detects an active task dropping out of the active payload", () => {
    const prev = [
      makeTask({ id: 1, status: "running" }),
      makeTask({ id: 2, status: "completed" }),
    ];
    expect(hasLostActive(prev, [])).toBe(true);
    expect(hasLostActive(prev, [makeTask({ id: 1, status: "running" })])).toBe(
      false,
    );
    // Terminal tasks missing from the active payload are expected.
    expect(hasLostActive([makeTask({ id: 2, status: "completed" })], [])).toBe(
      false,
    );
  });
});

describe("formatTaskStatus", () => {
  it("maps known statuses to Russian labels", () => {
    expect(formatTaskStatus("running")).toBe("Загрузка");
    expect(formatTaskStatus("completed")).toBe("Завершена");
    expect(formatTaskStatus("failed")).toBe("Ошибка");
    expect(formatTaskStatus("cancelled")).toBe("Отменена");
  });

  it("falls back to the raw string for unknown statuses", () => {
    expect(formatTaskStatus("migrating")).toBe("migrating");
    expect(formatTaskStatus("")).toBe("—");
  });
});
