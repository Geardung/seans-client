import { describe, expect, it } from "vitest";
import {
  COMPLETED_RATIO,
  createHistoryThrottle,
  HISTORY_SAVE_INTERVAL_MS,
  isHistorySaveDue,
  isPlaybackCompleted,
} from "../src/features/history/historyThrottle";

describe("isPlaybackCompleted (completed threshold)", () => {
  it("uses 95% of duration as the watched threshold", () => {
    expect(COMPLETED_RATIO).toBe(0.95);
    expect(isPlaybackCompleted(94, 100)).toBe(false);
    expect(isPlaybackCompleted(95, 100)).toBe(true);
    expect(isPlaybackCompleted(96, 100)).toBe(true);
  });

  it("treats position >= duration as completed", () => {
    expect(isPlaybackCompleted(100, 100)).toBe(true);
    expect(isPlaybackCompleted(120, 100)).toBe(true);
  });

  it("never completes without a positive duration", () => {
    expect(isPlaybackCompleted(50, 0)).toBe(false);
    expect(isPlaybackCompleted(50, -1)).toBe(false);
    expect(isPlaybackCompleted(50, null)).toBe(false);
    expect(isPlaybackCompleted(50, undefined)).toBe(false);
    expect(isPlaybackCompleted(50, Number.NaN)).toBe(false);
  });

  it("does not complete short clips at start (no absolute remaining rule)", () => {
    // A 20 s clip at 1 s is 5% — must not be marked watched.
    expect(isPlaybackCompleted(1, 20)).toBe(false);
    expect(isPlaybackCompleted(19, 20)).toBe(true);
  });

  it("treats missing position as 0", () => {
    expect(isPlaybackCompleted(null, 100)).toBe(false);
    expect(isPlaybackCompleted(undefined, 100)).toBe(false);
    expect(isPlaybackCompleted(Number.NaN, 100)).toBe(false);
  });
});

describe("isHistorySaveDue", () => {
  it("is due immediately on the first save", () => {
    expect(isHistorySaveDue(null, 1000)).toBe(true);
  });

  it("stays due only after the 15 s interval elapses", () => {
    expect(HISTORY_SAVE_INTERVAL_MS).toBe(15_000);
    expect(isHistorySaveDue(0, 14_999)).toBe(false);
    expect(isHistorySaveDue(0, 15_000)).toBe(true);
    expect(isHistorySaveDue(0, 20_000)).toBe(true);
  });
});

describe("createHistoryThrottle (15s cadence + force flags)", () => {
  it("saves at most every 15 s while playing", () => {
    let now = 0;
    const throttle = createHistoryThrottle({ now: () => now });

    expect(throttle.shouldSaveOnTick()).toBe(true); // t=0, first save
    now = 5_000;
    expect(throttle.shouldSaveOnTick()).toBe(false);
    now = 14_999;
    expect(throttle.shouldSaveOnTick()).toBe(false);
    now = 15_000;
    expect(throttle.shouldSaveOnTick()).toBe(true); // cadence elapsed
    now = 20_000;
    expect(throttle.shouldSaveOnTick()).toBe(false);
    now = 30_000;
    expect(throttle.shouldSaveOnTick()).toBe(true);
  });

  it("force-saves on pause / seek / close and restarts the cadence", () => {
    let now = 1_000;
    const throttle = createHistoryThrottle({ now: () => now });

    expect(throttle.shouldSaveOnTick()).toBe(true);
    now = 2_000;
    expect(throttle.shouldSaveOnTick()).toBe(false);

    // Force flags always save (pause / seek / close).
    expect(throttle.shouldForceSave()).toBe(true);
    expect(throttle.lastSavedAt()).toBe(2_000);

    // Cadence restarts from the forced save.
    now = 10_000;
    expect(throttle.shouldSaveOnTick()).toBe(false);
    now = 17_000;
    expect(throttle.shouldSaveOnTick()).toBe(true);

    expect(throttle.shouldForceSave()).toBe(true);
  });

  it("isDue peeks without consuming the cadence", () => {
    let now = 0;
    const throttle = createHistoryThrottle({ now: () => now });

    expect(throttle.isDue()).toBe(true);
    expect(throttle.shouldSaveOnTick()).toBe(true);
    now = 10_000;
    expect(throttle.isDue()).toBe(false);
    expect(throttle.shouldSaveOnTick()).toBe(false);
    now = 15_000;
    expect(throttle.isDue()).toBe(true);
    // Peek did not record a save.
    expect(throttle.lastSavedAt()).toBe(0);
    expect(throttle.shouldSaveOnTick()).toBe(true);
  });

  it("reset clears the last-save timestamp", () => {
    let now = 0;
    const throttle = createHistoryThrottle({ now: () => now });
    throttle.shouldSaveOnTick();
    now = 1_000;
    expect(throttle.shouldSaveOnTick()).toBe(false);
    throttle.reset();
    expect(throttle.lastSavedAt()).toBeNull();
    expect(throttle.shouldSaveOnTick()).toBe(true);
  });

  it("accepts a custom interval and clock override per call", () => {
    let now = 100;
    const throttle = createHistoryThrottle({ now: () => now, intervalMs: 10 });
    expect(throttle.shouldSaveOnTick(100)).toBe(true);
    expect(throttle.shouldSaveOnTick(105)).toBe(false);
    expect(throttle.shouldSaveOnTick(110)).toBe(true);
  });
});
