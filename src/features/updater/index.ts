/**
 * Updater feature barrel (M11). Pure policy helpers live in `updatePolicy`
 * (unit-tested); Tauri plugin access is wrapped in `updaterApi`.
 */

export { UpdateBanner } from "./UpdateBanner";
export { UpdateSettingsSection } from "./UpdateSettingsSection";
export { UpdaterProvider, useUpdater } from "./UpdaterProvider";
export type {
  UpdaterContextValue,
  UpdateProgress,
} from "./UpdaterProvider";
export {
  downloadPercent,
  isUpdateBannerPhase,
  isUpdateCheckDue,
  msUntilNextCheck,
  nextUpdatePhase,
  shouldCheckOnStartup,
  STARTUP_CHECK_DEBOUNCE_MS,
  UPDATE_CHECK_INTERVAL_MS,
  updatePhaseLabel,
} from "./updatePolicy";
export type { UpdateEvent, UpdatePhase } from "./updatePolicy";
export { checkForUpdate, readAppVersion, relaunchApp } from "./updaterApi";
export type { UpdateHandle, UpdaterDownloadEvent } from "./updaterApi";
