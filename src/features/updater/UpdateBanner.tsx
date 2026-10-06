/**
 * Non-modal update banner (M11). Passive chrome: it never covers the player
 * (AppShell mounts it only on non-full-bleed routes) and never blocks playback.
 */

import { Button, ProgressBar } from "../../design/primitives";
import { formatBytes } from "../../lib/format";
import {
  downloadPercent,
  updatePhaseLabel,
} from "./updatePolicy";
import { useUpdater } from "./UpdaterProvider";

export function UpdateBanner() {
  const {
    phase,
    availableVersion,
    progress,
    error,
    bannerVisible,
    applyOnExitPending,
    dismissBanner,
    restartNow,
    applyOnExit,
  } = useUpdater();

  if (!bannerVisible) return null;

  const percent =
    progress != null
      ? downloadPercent(progress.downloadedBytes, progress.totalBytes)
      : null;
  const progressLabel =
    progress != null
      ? progress.totalBytes != null
        ? `${formatBytes(progress.downloadedBytes)} / ${formatBytes(progress.totalBytes)}`
        : formatBytes(progress.downloadedBytes)
      : null;
  const busy = phase === "downloading" || phase === "applying";

  return (
    <div className="update-banner panel" role="status" aria-live="polite">
      <div className="update-banner-text">
        <strong>Доступно обновление</strong>
        <p className="hint">
          {availableVersion
            ? `Версия ${availableVersion} готова к установке.`
            : updatePhaseLabel(phase)}
          {applyOnExitPending ? " Установка выполнится при выходе." : ""}
        </p>
        {error ? <p className="update-banner-error">{error}</p> : null}
      </div>
      {progressLabel && busy ? (
        percent != null ? (
          <ProgressBar
            value={percent}
            max={100}
            label={`Загрузка: ${progressLabel}`}
          />
        ) : (
          <p className="hint">Загрузка: {progressLabel}</p>
        )
      ) : null}
      <div className="update-banner-actions">
        {phase === "ready" || phase === "applying" ? (
          <Button variant="primary" onClick={() => void restartNow()} disabled={phase === "applying"}>
            Перезапустить сейчас
          </Button>
        ) : null}
        {phase === "ready" && !applyOnExitPending ? (
          <Button variant="secondary" onClick={applyOnExit}>
            Установить при выходе
          </Button>
        ) : null}
        <Button variant="ghost" onClick={dismissBanner} disabled={busy && phase === "applying"}>
          Позже
        </Button>
      </div>
    </div>
  );
}
