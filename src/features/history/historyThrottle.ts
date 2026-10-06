/**
 * Pure watch-progress decisions (M9). No React/DOM — unit-testable.
 *
 * Save policy:
 * - while playing, persist progress at most every `HISTORY_SAVE_INTERVAL_MS` (15 s)
 * - force-save on pause / seek / close (unmount, player destroy)
 *
 * Completed policy (documented product choice):
 * a title counts as watched when `duration > 0` and `position / duration >= 0.95`.
 * We deliberately do NOT use an absolute "remaining < 30 s" rule: it would mark
 * short clips complete the moment they start. Near-the-end credits are included
 * in the 95% window on purpose — resuming there is noise.
 */

/** Minimum milliseconds between progress saves while playing. */
export const HISTORY_SAVE_INTERVAL_MS = 15_000;

/** Fraction of duration treated as "watched to the end". */
export const COMPLETED_RATIO = 0.95;

/**
 * True when playback is far enough along to treat the file as watched.
 * Missing / non-positive duration never completes.
 */
export function isPlaybackCompleted(
  positionSec: number | null | undefined,
  durationSec: number | null | undefined,
): boolean {
  const p = typeof positionSec === "number" && Number.isFinite(positionSec) ? positionSec : 0;
  const d = typeof durationSec === "number" && Number.isFinite(durationSec) ? durationSec : 0;
  if (d <= 0) return false;
  if (p >= d) return true;
  return p / d >= COMPLETED_RATIO;
}

/** Pure cadence check: has enough time passed since `lastSavedAt`? */
export function isHistorySaveDue(
  lastSavedAt: number | null,
  now: number,
  intervalMs: number = HISTORY_SAVE_INTERVAL_MS,
): boolean {
  if (lastSavedAt == null) return true;
  return now - lastSavedAt >= intervalMs;
}

export type HistoryThrottle = {
  /**
   * Playing tick: true (and records the save time) at most once per interval.
   * `now` overrides the injected clock — useful when the caller already read it.
   */
  shouldSaveOnTick: (now?: number) => boolean;
  /**
   * Pause / seek / close: always true and records the save time, so the next
   * playing tick restarts the 15 s cadence.
   */
  shouldForceSave: (now?: number) => boolean;
  /** Peek at cadence without recording a save. */
  isDue: (now?: number) => boolean;
  /** Clear the last-save timestamp (new file / new session). */
  reset: () => void;
  /** Last accepted save timestamp (epoch ms), or null when never saved. */
  lastSavedAt: () => number | null;
};

/**
 * Stateful throttle with an injectable clock (`now`), so cadence is unit-testable
 * without timers or `vi.useFakeTimers`.
 */
export function createHistoryThrottle(
  options: { now?: () => number; intervalMs?: number } = {},
): HistoryThrottle {
  const nowFn = typeof options.now === "function" ? options.now : () => Date.now();
  const intervalMs =
    typeof options.intervalMs === "number" &&
    Number.isFinite(options.intervalMs) &&
    options.intervalMs >= 0
      ? options.intervalMs
      : HISTORY_SAVE_INTERVAL_MS;
  let lastSavedAt: number | null = null;

  const readNow = (override?: number): number =>
    typeof override === "number" && Number.isFinite(override) ? override : nowFn();

  return {
    shouldSaveOnTick(now) {
      const t = readNow(now);
      if (!isHistorySaveDue(lastSavedAt, t, intervalMs)) return false;
      lastSavedAt = t;
      return true;
    },
    shouldForceSave(now) {
      lastSavedAt = readNow(now);
      return true;
    },
    isDue(now) {
      return isHistorySaveDue(lastSavedAt, readNow(now), intervalMs);
    },
    reset() {
      lastSavedAt = null;
    },
    lastSavedAt: () => lastSavedAt,
  };
}
