import { describe, expect, it } from "vitest";
import {
  downloadPercent,
  isUpdateBannerPhase,
  isUpdateCheckDue,
  msUntilNextCheck,
  nextUpdatePhase,
  shouldCheckOnStartup,
  STARTUP_CHECK_DEBOUNCE_MS,
  UPDATE_CHECK_INTERVAL_MS,
  updatePhaseLabel,
} from "../src/features/updater/updatePolicy";
import type { UpdateEvent, UpdatePhase } from "../src/features/updater/updatePolicy";

describe("shouldCheckOnStartup (startup policy)", () => {
  it("always checks when the app has never checked before", () => {
    expect(shouldCheckOnStartup(null, 1_000)).toBe(true);
    expect(shouldCheckOnStartup(undefined, 1_000)).toBe(true);
  });

  it("debounces rapid restarts inside the 5 minute window", () => {
    expect(STARTUP_CHECK_DEBOUNCE_MS).toBe(5 * 60 * 1000);
    expect(shouldCheckOnStartup(0, 1_000)).toBe(false);
    expect(shouldCheckOnStartup(0, STARTUP_CHECK_DEBOUNCE_MS - 1)).toBe(false);
  });

  it("checks again once the debounce window has passed", () => {
    expect(shouldCheckOnStartup(0, STARTUP_CHECK_DEBOUNCE_MS)).toBe(true);
    expect(shouldCheckOnStartup(0, STARTUP_CHECK_DEBOUNCE_MS + 1)).toBe(true);
    expect(shouldCheckOnStartup(1_000, 1_000 + STARTUP_CHECK_DEBOUNCE_MS)).toBe(true);
  });

  it("treats non-finite timestamps as never-checked", () => {
    expect(shouldCheckOnStartup(Number.NaN, 1_000)).toBe(true);
    expect(shouldCheckOnStartup(0, Number.NaN)).toBe(true);
  });

  it("accepts an explicit debounce override", () => {
    expect(shouldCheckOnStartup(0, 1_000, 500)).toBe(true);
    expect(shouldCheckOnStartup(0, 400, 500)).toBe(false);
  });
});

describe("schedule interval math (6h recurring check)", () => {
  it("uses a 6 hour interval", () => {
    expect(UPDATE_CHECK_INTERVAL_MS).toBe(6 * 60 * 60 * 1000);
  });

  it("is due immediately when never checked", () => {
    expect(isUpdateCheckDue(null, 0)).toBe(true);
    expect(isUpdateCheckDue(undefined, 0)).toBe(true);
    expect(isUpdateCheckDue(Number.NaN, 0)).toBe(true);
  });

  it("is not due before the interval elapses", () => {
    expect(isUpdateCheckDue(0, UPDATE_CHECK_INTERVAL_MS - 1)).toBe(false);
    expect(isUpdateCheckDue(0, UPDATE_CHECK_INTERVAL_MS)).toBe(true);
    expect(isUpdateCheckDue(0, UPDATE_CHECK_INTERVAL_MS * 2)).toBe(true);
  });

  it("respects an explicit interval override", () => {
    expect(isUpdateCheckDue(0, 999, 1_000)).toBe(false);
    expect(isUpdateCheckDue(0, 1_000, 1_000)).toBe(true);
  });

  it("counts down to the next check", () => {
    expect(msUntilNextCheck(0, 0)).toBe(UPDATE_CHECK_INTERVAL_MS);
    expect(msUntilNextCheck(0, UPDATE_CHECK_INTERVAL_MS / 2)).toBe(UPDATE_CHECK_INTERVAL_MS / 2);
    expect(msUntilNextCheck(0, UPDATE_CHECK_INTERVAL_MS)).toBe(0);
    expect(msUntilNextCheck(0, UPDATE_CHECK_INTERVAL_MS + 5)).toBe(0);
    expect(msUntilNextCheck(0, 500)).toBe(UPDATE_CHECK_INTERVAL_MS - 500);
  });

  it("returns 0 for non-finite input", () => {
    expect(msUntilNextCheck(Number.NaN, 0)).toBe(0);
    expect(msUntilNextCheck(0, Number.NaN)).toBe(0);
  });
});

describe("download state machine (nextUpdatePhase)", () => {
  it("walks idle → checking → available → downloading → ready → applying", () => {
    let phase: UpdatePhase = "idle";
    phase = nextUpdatePhase(phase, { type: "check-start" });
    expect(phase).toBe("checking");
    phase = nextUpdatePhase(phase, { type: "check-found" });
    expect(phase).toBe("available");
    phase = nextUpdatePhase(phase, { type: "download-start" });
    expect(phase).toBe("downloading");
    phase = nextUpdatePhase(phase, { type: "download-done" });
    expect(phase).toBe("ready");
    phase = nextUpdatePhase(phase, { type: "apply-start" });
    expect(phase).toBe("applying");
  });

  it("reports up-to-date when the check finds nothing", () => {
    expect(nextUpdatePhase("checking", { type: "check-none" })).toBe("up-to-date");
  });

  it("moves to error on failure and back to checking on a new check", () => {
    expect(nextUpdatePhase("checking", { type: "fail" })).toBe("error");
    expect(nextUpdatePhase("downloading", { type: "fail" })).toBe("error");
    expect(nextUpdatePhase("applying", { type: "fail" })).toBe("error");
    expect(nextUpdatePhase("error", { type: "check-start" })).toBe("checking");
  });

  it("resets any phase to idle", () => {
    const phases: UpdatePhase[] = [
      "idle",
      "checking",
      "up-to-date",
      "available",
      "downloading",
      "ready",
      "applying",
      "error",
    ];
    for (const phase of phases) {
      expect(nextUpdatePhase(phase, { type: "reset" })).toBe("idle");
    }
  });

  it("ignores unknown transitions (no backwards flips)", () => {
    expect(nextUpdatePhase("idle", { type: "download-done" })).toBe("idle");
    expect(nextUpdatePhase("ready", { type: "check-none" })).toBe("ready");
    expect(nextUpdatePhase("downloading", { type: "check-found" })).toBe("downloading");
    expect(nextUpdatePhase("applying", { type: "download-start" })).toBe("applying");
    // check-none / check-found only make sense while checking.
    expect(nextUpdatePhase("up-to-date", { type: "check-found" })).toBe("up-to-date");
  });

  it("allows a re-download from ready", () => {
    expect(nextUpdatePhase("ready", { type: "download-start" })).toBe("downloading");
    expect(nextUpdatePhase("available", { type: "apply-start" })).toBe("applying");
  });

  it("covers every event from every phase without throwing", () => {
    const phases: UpdatePhase[] = [
      "idle",
      "checking",
      "up-to-date",
      "available",
      "downloading",
      "ready",
      "applying",
      "error",
    ];
    const events: UpdateEvent["type"][] = [
      "check-start",
      "check-none",
      "check-found",
      "download-start",
      "download-done",
      "apply-start",
      "fail",
      "reset",
    ];
    for (const phase of phases) {
      for (const type of events) {
        const next = nextUpdatePhase(phase, { type } as UpdateEvent);
        expect(phases).toContain(next);
      }
    }
  });
});

describe("download state machine labels (Russian)", () => {
  it("labels every phase in Russian", () => {
    expect(updatePhaseLabel("idle")).toBe("Обновления не проверялись");
    expect(updatePhaseLabel("checking")).toBe("Проверка обновлений…");
    expect(updatePhaseLabel("up-to-date")).toBe("У вас последняя версия");
    expect(updatePhaseLabel("available")).toBe("Доступно обновление");
    expect(updatePhaseLabel("downloading")).toBe("Загрузка обновления…");
    expect(updatePhaseLabel("ready")).toBe("Обновление готово к установке");
    expect(updatePhaseLabel("applying")).toBe("Установка обновления…");
    expect(updatePhaseLabel("error")).toBe("Не удалось проверить обновления");
  });

  it("never renders empty labels", () => {
    const phases: UpdatePhase[] = [
      "idle",
      "checking",
      "up-to-date",
      "available",
      "downloading",
      "ready",
      "applying",
      "error",
    ];
    for (const phase of phases) {
      expect(updatePhaseLabel(phase).length).toBeGreaterThan(0);
    }
  });
});

describe("isUpdateBannerPhase", () => {
  it("shows the banner only while an update is in play", () => {
    expect(isUpdateBannerPhase("available")).toBe(true);
    expect(isUpdateBannerPhase("downloading")).toBe(true);
    expect(isUpdateBannerPhase("ready")).toBe(true);
    expect(isUpdateBannerPhase("applying")).toBe(true);
    expect(isUpdateBannerPhase("idle")).toBe(false);
    expect(isUpdateBannerPhase("checking")).toBe(false);
    expect(isUpdateBannerPhase("up-to-date")).toBe(false);
    expect(isUpdateBannerPhase("error")).toBe(false);
  });
});

describe("downloadPercent", () => {
  it("computes a 0–100 percent when the total is known", () => {
    expect(downloadPercent(0, 100)).toBe(0);
    expect(downloadPercent(50, 100)).toBe(50);
    expect(downloadPercent(100, 100)).toBe(100);
    expect(downloadPercent(150, 100)).toBe(100);
  });

  it("returns null when the total size is unknown", () => {
    expect(downloadPercent(10, null)).toBe(null);
    expect(downloadPercent(10, undefined)).toBe(null);
    expect(downloadPercent(10, 0)).toBe(null);
    expect(downloadPercent(10, -5)).toBe(null);
    expect(downloadPercent(10, Number.NaN)).toBe(null);
  });

  it("treats non-finite downloaded bytes as zero", () => {
    expect(downloadPercent(Number.NaN, 100)).toBe(0);
    expect(downloadPercent(-10, 100)).toBe(0);
  });
});
