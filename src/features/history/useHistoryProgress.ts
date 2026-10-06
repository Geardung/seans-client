/**
 * Watch-progress tracking (M9). Feeds player snapshots into the 15 s throttle
 * and PUTs /api/history. Force-saves on pause / seek / unmount.
 *
 * Room mode (M10) passes `enabled: false` — host sync owns progress there.
 */

import { useCallback, useEffect, useMemo, useRef } from "react";
import { putHistory, type HistoryWritePayload } from "../../api/endpoints";
import { createHistoryThrottle, isPlaybackCompleted } from "./historyThrottle";

export type HistoryProgressSnapshot = {
  positionSec: number;
  durationSec: number;
  paused: boolean;
};

export type UseHistoryProgressOptions = {
  taskFileId: string | number;
  /** Disable tracking (room mode). Default true. */
  enabled?: boolean;
  /** Injectable clock for tests. */
  now?: () => number;
  /** Injectable persistence for tests. Defaults to `putHistory`. */
  save?: (payload: HistoryWritePayload) => Promise<unknown>;
};

export type UseHistoryProgressResult = {
  /** Call on every player state tick; applies the 15 s playing cadence. */
  track: (snapshot: HistoryProgressSnapshot) => void;
  /** Force-save (user seek, explicit flush). */
  flush: (snapshot?: HistoryProgressSnapshot) => void;
};

function isTrackable(s: HistoryProgressSnapshot): boolean {
  return (
    typeof s.positionSec === "number" &&
    Number.isFinite(s.positionSec) &&
    typeof s.durationSec === "number" &&
    Number.isFinite(s.durationSec) &&
    s.durationSec > 0
  );
}

function isMeaningful(s: HistoryProgressSnapshot): boolean {
  // position 0 with no prior progress is just "opened" — not worth a PUT.
  return isTrackable(s) && s.positionSec > 0;
}

export function useHistoryProgress(
  options: UseHistoryProgressOptions,
): UseHistoryProgressResult {
  const { taskFileId, enabled = true, now, save } = options;

  const throttle = useMemo(
    () => createHistoryThrottle(now ? { now } : {}),
    [now],
  );
  const saveRef = useRef(save);
  saveRef.current = save;
  const taskFileIdRef = useRef(taskFileId);
  taskFileIdRef.current = taskFileId;
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const lastRef = useRef<HistoryProgressSnapshot | null>(null);
  const prevPausedRef = useRef<boolean | null>(null);
  const dirtyRef = useRef(false);
  /** One forced save once the completed threshold is crossed (near end). */
  const completedSentRef = useRef(false);

  const persist = useCallback(
    (snapshot: HistoryProgressSnapshot) => {
      dirtyRef.current = false;
      const payload: HistoryWritePayload = {
        taskFileId: taskFileIdRef.current,
        positionSec: snapshot.positionSec,
        durationSec: snapshot.durationSec,
      };
      const run = saveRef.current ?? putHistory;
      void Promise.resolve(run(payload)).catch(() => {
        // Best-effort: a failed save retries on the next tick / flush.
        dirtyRef.current = true;
      });
    },
    [],
  );

  const track = useCallback(
    (snapshot: HistoryProgressSnapshot) => {
      if (!enabledRef.current) return;
      if (!isTrackable(snapshot)) return;
      lastRef.current = snapshot;

      const wasPaused = prevPausedRef.current;
      prevPausedRef.current = snapshot.paused;

      if (!isMeaningful(snapshot) && !dirtyRef.current) return;

      // playing → paused: force save (edge-triggered, not every paused tick).
      if (snapshot.paused && wasPaused === false) {
        throttle.shouldForceSave();
        persist(snapshot);
        return;
      }
      if (snapshot.paused) return;

      dirtyRef.current = true;

      // Crossing the completed threshold forces one save so the server can
      // mark the row done without waiting for the next 15 s tick / pause.
      if (
        !completedSentRef.current &&
        isPlaybackCompleted(snapshot.positionSec, snapshot.durationSec)
      ) {
        completedSentRef.current = true;
        throttle.shouldForceSave();
        persist(snapshot);
        return;
      }

      if (throttle.shouldSaveOnTick()) {
        persist(snapshot);
      }
    },
    [persist, throttle],
  );

  const flush = useCallback(
    (snapshot?: HistoryProgressSnapshot) => {
      if (!enabledRef.current) return;
      const next = snapshot ?? lastRef.current;
      if (!next || !isTrackable(next)) return;
      lastRef.current = next;
      throttle.shouldForceSave();
      persist(next);
    },
    [persist, throttle],
  );

  // New file id: drop cadence / completion state from the previous title.
  useEffect(() => {
    throttle.reset();
    lastRef.current = null;
    prevPausedRef.current = null;
    dirtyRef.current = false;
    completedSentRef.current = false;
  }, [taskFileId, throttle]);

  // Final save on unmount (route leave / player destroy) when progress moved.
  useEffect(() => {
    return () => {
      if (!enabledRef.current) return;
      const last = lastRef.current;
      if (!last || !dirtyRef.current) return;
      const payload: HistoryWritePayload = {
        taskFileId: taskFileIdRef.current,
        positionSec: last.positionSec,
        durationSec: last.durationSec,
      };
      const run = saveRef.current ?? putHistory;
      void Promise.resolve(run(payload)).catch(() => {});
    };
  }, []);

  return { track, flush };
}
