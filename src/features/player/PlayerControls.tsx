/**
 * Overlay transport controls for the libmpv surface (M7).
 * Russian labels; token-only styling via `player.css` classes.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, RefObject } from "react";
import { Button } from "../../design/primitives";
import { ChaptersMenu, SeekMarkers } from "../theintrodb/SegmentChrome";
import type { SegmentMarker } from "../theintrodb/types";
import {
  formatTime,
  formatTrackId,
  formatTrackLabel,
  parseTrackId,
  positionPercent,
  ratioToPosition,
  SPEED_OPTIONS,
} from "./playerHelpers";
import type { PlayerSnapshot } from "./playerTypes";

export type PlayerControlsProps = {
  snapshot: PlayerSnapshot;
  visible: boolean;
  onSeek: (seconds: number) => void;
  onTogglePause: () => void;
  onSetSpeed: (speed: number) => void;
  onSetVolume: (volume: number) => void;
  onToggleMute: () => void;
  onSetAudioTrack: (id: number) => void;
  onSetSubtitleTrack: (id: number | null) => void;
  onToggleFullscreen: () => void;
  /** TheIntroDB seek-bar markers (M8); empty when the feature is off. */
  markers?: SegmentMarker[];
  /** Chapter rows for the «Главы» menu. */
  chapters?: SegmentMarker[];
  onSeekChapter?: (seconds: number) => void;
  hwdecLabel: string;
};

function useDragSeek(
  duration: number,
  onSeek: (seconds: number) => void,
): {
  railRef: RefObject<HTMLDivElement | null>;
  dragging: boolean;
  dragPercent: number;
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
} {
  const railRef = useRef<HTMLDivElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const [dragPercent, setDragPercent] = useState(0);

  const ratioFromEvent = useCallback((clientX: number): number => {
    const rail = railRef.current;
    if (!rail) return 0;
    const rect = rail.getBoundingClientRect();
    if (rect.width <= 0) return 0;
    return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
  }, []);

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      const rail = railRef.current;
      if (!rail) return;
      rail.setPointerCapture(event.pointerId);
      setDragging(true);
      const ratio = ratioFromEvent(event.clientX);
      setDragPercent(ratio * 100);
      onSeek(ratioToPosition(ratio, duration));
    },
    [duration, onSeek, ratioFromEvent],
  );

  useEffect(() => {
    const rail = railRef.current;
    if (!rail || !dragging) return;

    const onMove = (event: PointerEvent) => {
      const ratio = ratioFromEvent(event.clientX);
      setDragPercent(ratio * 100);
      onSeek(ratioToPosition(ratio, duration));
    };
    const onUp = (event: PointerEvent) => {
      const ratio = ratioFromEvent(event.clientX);
      setDragging(false);
      try {
        rail.releasePointerCapture(event.pointerId);
      } catch {
        // capture may already be gone
      }
      onSeek(ratioToPosition(ratio, duration));
    };

    rail.addEventListener("pointermove", onMove);
    rail.addEventListener("pointerup", onUp);
    rail.addEventListener("pointercancel", onUp);
    return () => {
      rail.removeEventListener("pointermove", onMove);
      rail.removeEventListener("pointerup", onUp);
      rail.removeEventListener("pointercancel", onUp);
    };
  }, [dragging, duration, onSeek, ratioFromEvent]);

  return { railRef, dragging, dragPercent, onPointerDown };
}

export function PlayerControls({
  snapshot,
  visible,
  onSeek,
  onTogglePause,
  onSetSpeed,
  onSetVolume,
  onToggleMute,
  onSetAudioTrack,
  onSetSubtitleTrack,
  onToggleFullscreen,
  markers,
  chapters,
  onSeekChapter,
  hwdecLabel,
}: PlayerControlsProps) {
  const duration = snapshot.duration;
  const percent = snapshot.file_loaded
    ? positionPercent(snapshot.position, duration)
    : 0;
  const { railRef, dragging, dragPercent, onPointerDown } = useDragSeek(
    duration,
    onSeek,
  );

  const audioTracks = snapshot.tracks.filter((t) => t.kind === "audio");
  const subTracks = snapshot.tracks.filter((t) => t.kind === "sub");
  const selectedAudio = audioTracks.find((t) => t.selected)?.id ?? 0;
  const selectedSub = subTracks.find((t) => t.selected)?.id ?? 0;

  return (
    <div
      className={`player-controls${visible ? " player-controls-visible" : ""}`}
      role="group"
      aria-label="Управление воспроизведением"
    >
      <div
        className="player-seek"
        ref={railRef}
        onPointerDown={onPointerDown}
        role="slider"
        tabIndex={0}
        aria-label="Позиция воспроизведения"
        aria-valuemin={0}
        aria-valuemax={Math.max(0, Math.round(duration))}
        aria-valuenow={Math.round(snapshot.position)}
        aria-valuetext={`${formatTime(snapshot.position)} / ${formatTime(duration)}`}
      >
        <div className="player-seek-track">
          <div
            className="player-seek-fill"
            style={{ width: `${dragging ? dragPercent : percent}%` }}
          />
          {markers && markers.length > 0 ? (
            <SeekMarkers markers={markers} duration={duration} />
          ) : null}
        </div>
      </div>

      <div className="player-controls-row">
        <div className="player-controls-left">
          <Button
            variant="ghost"
            size="sm"
            onClick={onTogglePause}
            aria-label={snapshot.pause ? "Воспроизвести" : "Пауза"}
            title={snapshot.pause ? "Воспроизвести (Пробел)" : "Пауза (Пробел)"}
          >
            {snapshot.pause ? "▶" : "❚❚"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleMute}
            aria-label={snapshot.mute ? "Включить звук" : "Выключить звук"}
            title="Звук (M)"
          >
            {snapshot.mute ? "🔇" : "🔊"}
          </Button>
          <input
            className="player-volume"
            type="range"
            min={0}
            max={100}
            step={1}
            value={Math.round(snapshot.mute ? 0 : snapshot.volume)}
            onChange={(event) => onSetVolume(Number(event.target.value))}
            aria-label="Громкость"
            title="Громкость (↑ / ↓)"
          />
          <span className="player-time">
            {formatTime(snapshot.position)} / {formatTime(duration)}
          </span>
        </div>

        <div className="player-controls-right">
          <label className="player-select-wrap">
            <span className="player-select-label">Скорость</span>
            <select
              className="player-select"
              value={String(snapshot.speed)}
              onChange={(event) => onSetSpeed(Number(event.target.value))}
              aria-label="Скорость воспроизведения"
            >
              {SPEED_OPTIONS.map((speed) => (
                <option key={speed} value={String(speed)}>
                  {speed}×
                </option>
              ))}
            </select>
          </label>

          <label className="player-select-wrap">
            <span className="player-select-label">Аудио</span>
            <select
              className="player-select"
              value={formatTrackId("audio", selectedAudio)}
              onChange={(event) => {
                const { id } = parseTrackId(event.target.value);
                onSetAudioTrack(id);
              }}
              aria-label="Аудиодорожка"
            >
              {audioTracks.length === 0 ? (
                <option value="audio:0">—</option>
              ) : (
                audioTracks.map((track) => (
                  <option key={track.id} value={formatTrackId("audio", track.id)}>
                    {formatTrackLabel(track)}
                  </option>
                ))
              )}
            </select>
          </label>

          <label className="player-select-wrap">
            <span className="player-select-label">Субтитры</span>
            <select
              className="player-select"
              value={formatTrackId("sub", selectedSub)}
              onChange={(event) => {
                const { id } = parseTrackId(event.target.value);
                onSetSubtitleTrack(id > 0 ? id : null);
              }}
              aria-label="Субтитры"
            >
              <option value="sub:0">Выкл</option>
              {subTracks.map((track) => (
                <option key={track.id} value={formatTrackId("sub", track.id)}>
                  {formatTrackLabel(track)}
                </option>
              ))}
            </select>
          </label>

          <ChaptersMenu
            markers={chapters ?? []}
            onSeekMs={(ms) => onSeekChapter?.(ms / 1000)}
            disabled={!onSeekChapter}
          />

          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleFullscreen}
            aria-label={snapshot.fullscreen ? "Выйти из полноэкранного режима" : "Полный экран"}
            title="Полный экран (F)"
          >
            {snapshot.fullscreen ? "⤡" : "⛶"}
          </Button>
        </div>
      </div>

      <div className="player-hwdec" title="Режим декодирования">
        {hwdecLabel}
      </div>
    </div>
  );
}
