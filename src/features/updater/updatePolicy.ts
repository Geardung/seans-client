/**
 * Pure update policy helpers (M11). No React/DOM — unit-testable.
 *
 * Policy:
 * - Check once on startup after the auth gate is ready, debounced across rapid restarts.
 * - Re-check every `UPDATE_CHECK_INTERVAL_MS` (6 h).
 * - Manual check from Settings is always allowed and bypasses the debounce.
 * - Download runs in the background; playback is never blocked (banner is passive UI).
 */

/** Recurring re-check cadence (6 hours). */
export const UPDATE_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

/** Skip the automatic startup check when the last one is this recent. */
export const STARTUP_CHECK_DEBOUNCE_MS = 5 * 60 * 1000;

/** Download / install lifecycle shown in Settings and the update banner. */
export type UpdatePhase =
  | "idle"
  | "checking"
  | "up-to-date"
  | "available"
  | "downloading"
  | "ready"
  | "applying"
  | "error";

/** Events that drive the download state machine. */
export type UpdateEvent =
  | { type: "check-start" }
  | { type: "check-none" }
  | { type: "check-found" }
  | { type: "download-start" }
  | { type: "download-done" }
  | { type: "apply-start" }
  | { type: "fail" }
  | { type: "reset" };

/**
 * True when the startup check should run.
 * Never-checked always checks; otherwise the result is debounced so that
 * restarting the app twice in a row does not hit the endpoint again.
 */
export function shouldCheckOnStartup(
  lastCheckedAt: number | null | undefined,
  now: number,
  debounceMs: number = STARTUP_CHECK_DEBOUNCE_MS,
): boolean {
  if (lastCheckedAt == null || !Number.isFinite(lastCheckedAt)) return true;
  if (!Number.isFinite(now)) return true;
  return now - lastCheckedAt >= debounceMs;
}

/** Pure cadence check for the recurring 6 h timer. */
export function isUpdateCheckDue(
  lastCheckedAt: number | null | undefined,
  now: number,
  intervalMs: number = UPDATE_CHECK_INTERVAL_MS,
): boolean {
  if (lastCheckedAt == null || !Number.isFinite(lastCheckedAt)) return true;
  if (!Number.isFinite(now)) return true;
  return now - lastCheckedAt >= intervalMs;
}

/** Milliseconds until the next recurring check (0 when already due). */
export function msUntilNextCheck(
  lastCheckedAt: number,
  now: number,
  intervalMs: number = UPDATE_CHECK_INTERVAL_MS,
): number {
  if (!Number.isFinite(lastCheckedAt) || !Number.isFinite(now)) return 0;
  return Math.max(0, lastCheckedAt + intervalMs - now);
}

/**
 * Deterministic download state machine. Unknown transitions are no-ops
 * (return the current phase) so a stray event can never flip the UI backwards.
 */
export function nextUpdatePhase(phase: UpdatePhase, event: UpdateEvent): UpdatePhase {
  switch (phase) {
    case "idle":
    case "up-to-date":
    case "error":
      if (event.type === "check-start") return "checking";
      if (event.type === "reset") return "idle";
      return phase;
    case "checking":
      if (event.type === "check-none") return "up-to-date";
      if (event.type === "check-found") return "available";
      if (event.type === "fail") return "error";
      if (event.type === "reset") return "idle";
      return phase;
    case "available":
      if (event.type === "download-start") return "downloading";
      if (event.type === "apply-start") return "applying";
      if (event.type === "fail") return "error";
      if (event.type === "reset") return "idle";
      return phase;
    case "downloading":
      if (event.type === "download-done") return "ready";
      if (event.type === "fail") return "error";
      if (event.type === "reset") return "idle";
      return phase;
    case "ready":
      if (event.type === "apply-start") return "applying";
      if (event.type === "download-start") return "downloading";
      if (event.type === "fail") return "error";
      if (event.type === "reset") return "idle";
      return phase;
    case "applying":
      if (event.type === "fail") return "error";
      if (event.type === "reset") return "idle";
      return phase;
  }
}

/** Russian status label for Settings and the banner. */
export function updatePhaseLabel(phase: UpdatePhase): string {
  switch (phase) {
    case "idle":
      return "Обновления не проверялись";
    case "checking":
      return "Проверка обновлений…";
    case "up-to-date":
      return "У вас последняя версия";
    case "available":
      return "Доступно обновление";
    case "downloading":
      return "Загрузка обновления…";
    case "ready":
      return "Обновление готово к установке";
    case "applying":
      return "Установка обновления…";
    case "error":
      return "Не удалось проверить обновления";
  }
}

/** True when the banner should surface (update found or being applied). */
export function isUpdateBannerPhase(phase: UpdatePhase): boolean {
  return (
    phase === "available" ||
    phase === "downloading" ||
    phase === "ready" ||
    phase === "applying"
  );
}

/**
 * Download progress percent 0–100, or null when the total size is unknown
 * (server omitted Content-Length) — the UI then shows an indeterminate bar.
 */
export function downloadPercent(
  downloadedBytes: number,
  totalBytes: number | null | undefined,
): number | null {
  if (totalBytes == null || !Number.isFinite(totalBytes) || totalBytes <= 0) return null;
  const d = Number.isFinite(downloadedBytes) ? Math.max(0, downloadedBytes) : 0;
  return Math.min(100, (d / totalBytes) * 100);
}
