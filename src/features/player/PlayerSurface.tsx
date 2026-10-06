/**
 * Full-bleed player surface (M7 + M8): video host + overlay controls,
 * TheIntroDB skip buttons / markers / credits popup when segments are present.
 *
 * The actual video pixels are drawn by libmpv into a Win32 child window
 * (`wid`) behind the webview; this component is the HTML chrome and input
 * layer (controls, keyboard, auto-hide).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Button, ErrorState, Spinner } from "../../design/primitives";
import { CreditsPopup } from "../theintrodb/CreditsPopup";
import { SkipButtons } from "../theintrodb/SegmentChrome";
import { EMPTY_BUNDLE } from "../theintrodb/types";
import type { TheIntroDbBundle } from "../theintrodb/types";
import { useSegmentChrome } from "../theintrodb/useSegmentChrome";
import { PlayerControls } from "./PlayerControls";
import {
  applySeekDelta,
  clampSpeed,
  formatHwdec,
  OVERLAY_IDLE_MS,
  SEEK_STEP_SEC,
} from "./playerHelpers";
import type { UsePlayerState } from "./usePlayer";

export type PlayerSurfaceProps = {
  player: UsePlayerState;
  /** TheIntroDB segments; empty bundle = feature off. */
  segments?: TheIntroDbBundle;
  /** Media id for the credits review PUT. */
  mediaId?: string | number | null;
  /** Skip credits popup when the user already reviewed. */
  alreadyReviewed?: boolean;
};

export function PlayerSurface({
  player,
  segments,
  mediaId = null,
  alreadyReviewed = false,
}: PlayerSurfaceProps) {
  const { phase, snapshot, error, retry } = player;
  const [controlsVisible, setControlsVisible] = useState(true);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const surfaceRef = useRef<HTMLDivElement | null>(null);

  const bumpIdle = useCallback(() => {
    setControlsVisible(true);
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => setControlsVisible(false), OVERLAY_IDLE_MS);
  }, []);

  // Hide once on first idle tick; re-show on any mouse move.
  useEffect(() => {
    bumpIdle();
    return () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, [bumpIdle]);

  // Keep the mpv child window in sync with the Tauri window size.
  useEffect(() => {
    const onResize = () => {
      void player.syncSize();
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [player]);

  const togglePause = useCallback(() => {
    void player.togglePause();
    bumpIdle();
  }, [player, bumpIdle]);

  const seekTo = useCallback(
    (seconds: number) => {
      void player.seek(seconds);
      bumpIdle();
    },
    [player, bumpIdle],
  );

  const seekMs = useCallback(
    (ms: number) => {
      seekTo(ms / 1000);
    },
    [seekTo],
  );

  /** TheIntroDB skip is personal — never broadcast via room `state`. */
  const seekMsPersonal = useCallback(
    (ms: number) => {
      void player.seek(ms / 1000, { personal: true });
      bumpIdle();
    },
    [player, bumpIdle],
  );

  const bundle = segments ?? EMPTY_BUNDLE;
  const positionMs = snapshot.position * 1000;
  const chrome = useSegmentChrome({
    bundle,
    positionMs,
    onSeekMs: seekMs,
    mediaId,
    alreadyReviewed,
  });

  // Keyboard: Space / ← / → / ↑ / ↓ / F / M.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;

      switch (event.key) {
        case " ":
        case "Spacebar":
          event.preventDefault();
          togglePause();
          break;
        case "ArrowLeft":
          event.preventDefault();
          seekTo(applySeekDelta(snapshot.position, -SEEK_STEP_SEC, snapshot.duration));
          break;
        case "ArrowRight":
          event.preventDefault();
          seekTo(applySeekDelta(snapshot.position, SEEK_STEP_SEC, snapshot.duration));
          break;
        case "ArrowUp":
          event.preventDefault();
          void player.setVolume(Math.min(100, snapshot.volume + 5));
          bumpIdle();
          break;
        case "ArrowDown":
          event.preventDefault();
          void player.setVolume(Math.max(0, snapshot.volume - 5));
          bumpIdle();
          break;
        case "f":
        case "F":
        case "а":
        case "А":
          event.preventDefault();
          void player.setFullscreen(!snapshot.fullscreen);
          bumpIdle();
          break;
        case "m":
        case "M":
        case "ь":
        case "Ь":
          event.preventDefault();
          void player.setMute(!snapshot.mute);
          bumpIdle();
          break;
        default:
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [player, snapshot, togglePause, seekTo, bumpIdle]);

  if (phase === "loading") {
    return (
      <div className="player-surface player-surface-status" ref={surfaceRef}>
        <Spinner label="Загрузка плеера…" />
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="player-surface player-surface-status" ref={surfaceRef}>
        <ErrorState
          title="Не удалось открыть файл"
          description={
            error ?? "Проверьте статус загрузки и попробуйте снова."
          }
          onRetry={retry}
        />
        <Button variant="ghost" size="sm" onClick={() => window.history.back()}>
          Назад
        </Button>
      </div>
    );
  }

  return (
    <div
      className="player-surface"
      ref={surfaceRef}
      onMouseMove={bumpIdle}
      onClick={(event) => {
        // Clicks on empty surface toggle pause; controls stop propagation.
        if (event.target === surfaceRef.current) togglePause();
      }}
    >
      {chrome.creditsPopupOpen && mediaId != null ? (
        <CreditsPopup
          mediaId={mediaId}
          onSubmitted={chrome.onCreditsSubmitted}
          onDismiss={chrome.onDismissCredits}
        />
      ) : null}

      <SkipButtons
        skips={chrome.skips}
        visible={chrome.skipVisible}
        onSkip={seekMsPersonal}
      />

      <PlayerControls
        snapshot={snapshot}
        visible={controlsVisible}
        onSeek={seekTo}
        onTogglePause={togglePause}
        onSetSpeed={(speed) => {
          void player.setSpeed(clampSpeed(speed));
          bumpIdle();
        }}
        onSetVolume={(volume) => {
          void player.setVolume(volume);
          bumpIdle();
        }}
        onToggleMute={() => {
          void player.setMute(!snapshot.mute);
          bumpIdle();
        }}
        onSetAudioTrack={(id) => {
          void player.setAudioTrack(id);
          void player.refreshTracks();
          bumpIdle();
        }}
        onSetSubtitleTrack={(id) => {
          void player.setSubtitleTrack(id);
          void player.refreshTracks();
          bumpIdle();
        }}
        onToggleFullscreen={() => {
          void player.setFullscreen(!snapshot.fullscreen);
          bumpIdle();
        }}
        markers={chrome.markers}
        chapters={chrome.markers}
        onSeekChapter={seekTo}
        hwdecLabel={formatHwdec(snapshot.hwdec)}
      />
    </div>
  );
}
