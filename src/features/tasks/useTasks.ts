/**
 * Task list loader + poller (M5).
 *
 * - Initial load: GET /api/tasks (full list).
 * - While any task is active, poll GET /api/tasks?active=true every
 *   TASK_POLL_ACTIVE_MS (3s) and merge into the known list.
 * - When a task leaves the active payload it just finished — reload once so
 *   the terminal status/progress is shown.
 * - Polling stops when every task is terminal. Interval + in-flight fetches
 *   are cleaned up on unmount.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  cancelTask as cancelTaskRequest,
  fetchTasks,
} from "../../api/endpoints";
import type { ApiId, TaskDetailResponse } from "../../api/types";
import {
  hasLostActive,
  isTaskActive,
  mergeActiveTasks,
  taskPollInterval,
} from "./taskHelpers";

export type TasksStatus = "loading" | "ready" | "error";

export type TasksState = {
  tasks: TaskDetailResponse[];
  status: TasksStatus;
  error: string | null;
  refresh: () => void;
  cancel: (taskId: ApiId) => Promise<void>;
  cancelingId: ApiId | null;
  cancelError: string | null;
};

export function useTasks(): TasksState {
  const [tasks, setTasks] = useState<TaskDetailResponse[]>([]);
  const [status, setStatus] = useState<TasksStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [cancelingId, setCancelingId] = useState<ApiId | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);

  // Latest list for the poll closure without re-creating the interval.
  const tasksRef = useRef<TaskDetailResponse[]>(tasks);
  tasksRef.current = tasks;

  const refresh = useCallback(() => {
    setReloadToken((token) => token + 1);
  }, []);

  const cancel = useCallback(async (taskId: ApiId) => {
    setCancelingId(taskId);
    setCancelError(null);
    try {
      const updated = await cancelTaskRequest(taskId);
      setTasks((prev) =>
        prev.map((task) =>
          String(task.id) === String(updated.id) ? updated : task,
        ),
      );
    } catch (cause) {
      setCancelError(
        cause instanceof Error ? cause.message : "Не удалось отменить задачу",
      );
    } finally {
      setCancelingId(null);
    }
  }, []);

  // Full list load (mount + manual refresh).
  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    setStatus("loading");
    setError(null);

    void (async () => {
      try {
        const items = await fetchTasks({ signal: controller.signal });
        if (cancelled || controller.signal.aborted) return;
        tasksRef.current = items;
        setTasks(items);
        setStatus("ready");
      } catch (cause) {
        if (cancelled || controller.signal.aborted) return;
        setStatus("error");
        setError(
          cause instanceof Error ? cause.message : "Не удалось загрузить задачи",
        );
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [reloadToken]);

  // Poll while anything is active. Depends on a boolean so the interval is
  // not torn down on every poll tick.
  const hasActive = tasks.some((task) => isTaskActive(task.status));

  useEffect(() => {
    if (status !== "ready" || !hasActive) return;

    const controller = new AbortController();
    let cancelled = false;

    const timer = window.setInterval(() => {
      void (async () => {
        try {
          const active = await fetchTasks({
            active: true,
            signal: controller.signal,
          });
          if (cancelled || controller.signal.aborted) return;

          const prev = tasksRef.current;
          if (hasLostActive(prev, active)) {
            // Someone finished — pull the full list once for terminal fields.
            const all = await fetchTasks({ signal: controller.signal });
            if (cancelled || controller.signal.aborted) return;
            tasksRef.current = all;
            setTasks(all);
            return;
          }

          const merged = mergeActiveTasks(prev, active);
          tasksRef.current = merged;
          setTasks(merged);
        } catch {
          // Keep the last good snapshot; the next tick retries.
        }
      })();
    }, taskPollInterval(tasksRef.current) ?? 3000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      controller.abort();
    };
  }, [status, hasActive, reloadToken]);

  return {
    tasks,
    status,
    error,
    refresh,
    cancel,
    cancelingId,
    cancelError,
  };
}
