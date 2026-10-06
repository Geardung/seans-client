import { useEffect, useMemo, useRef, useState } from "react";
import { fetchFileUrl } from "../api/endpoints";
import {
  consumeStartAt,
  PlayerSurface,
  usePlayer,
} from "../features/player";
import type { UsePlayerState } from "../features/player";
import { fetchResumePosition, useHistoryProgress } from "../features/history";
import { useTheIntroDb } from "../features/theintrodb";
import "../features/player/player.css";

/** Local transport action names shared with the room WS `state` frames. */
export type RoomTransportAction = "play" | "pause" | "seek";

/** Player access surface used by the room socket (heartbeats + guest apply). */
export type RoomTransport = {
  /** Current playback position in seconds. */
  getPosition: () => number;
  /** Apply a remote room command (guest). */
  apply: (
    action: RoomTransportAction,
    position: number,
    isPlaying?: boolean,
  ) => Promise<void>;
};

/**
 * Player screen (M7 + M8 + M9). Full-bleed via `isFullBleedRoute` (no left nav).
 *
 * Flow: `fetchFileUrl(fileId)` → `player_open(url)` → in-process libmpv.
 * Resume (M9): explicit `startAt` (openPlayer stash / prop) wins; otherwise
 * GET /api/history and seek to `position_sec` unless completed. Room mode
 * (M10) sets `roomMode` — resume and local progress tracking are skipped
 * there because host sync owns the position.
 * Progress (M9): player ticks → throttled PUT /api/history; force-save on
 * pause / seek / unmount.
 * TheIntroDB (M8) loads segments for the file's media; off when tmdb_id is null.
 * Rooms (M10): `onTransport` reports local play/pause/seek (host broadcast) and
 * `transportRef` exposes position/apply for heartbeats + guest remote control.
 */
export function PlayerScreen({
  fileId,
  startAt,
  roomMode = false,
  onTransport,
  transportRef,
}: {
  fileId: string;
  startAt?: number | null;
  /** Room playback (M10): skip history resume + progress tracking. */
  roomMode?: boolean;
  /** Room (M10): local play/pause/seek — host broadcasts these over WS. */
  onTransport?: (action: RoomTransportAction, position: number) => void;
  /** Room (M10): player transport for heartbeats and guest remote apply. */
  transportRef?: { current: RoomTransport | null };
}) {
  const player = usePlayer();
  const [openToken, setOpenToken] = useState(0);
  const lastFileRef = useRef<string | null>(null);
  const intro = useTheIntroDb(fileId);

  // Consume a resume position once per file id (clean M9 hook).
  const resumeAt = useRef<number | null>(null);
  if (lastFileRef.current !== fileId) {
    lastFileRef.current = fileId;
    resumeAt.current = startAt ?? consumeStartAt();
  }

  const historyProgress = useHistoryProgress({
    taskFileId: fileId,
    enabled: !roomMode,
  });

  // Force-save after a user seek (throttle would otherwise wait out the 15 s).
  const progressRef = useRef(historyProgress);
  progressRef.current = historyProgress;

  // Room (M10): report local transport and expose apply/getPosition.
  const onTransportRef = useRef(onTransport);
  onTransportRef.current = onTransport;
  const snapshotRef = useRef(player.snapshot);
  snapshotRef.current = player.snapshot;
  const playerRef = useRef(player);
  playerRef.current = player;

  useEffect(() => {
    if (!transportRef) return;
    const transport: RoomTransport = {
      getPosition: () => snapshotRef.current.position,
      apply: async (action, position, isPlaying) => {
        const p = playerRef.current;
        const snap = snapshotRef.current;
        // Always seek on explicit seek; otherwise only when we are out of range
        // so gentle play/pause frames do not cause visible jumps.
        const needsSeek =
          action === "seek" || Math.abs(snap.position - position) > 1.5;
        if (needsSeek) {
          await p.seek(position);
        }
        const playRequested =
          action === "play" || (action !== "pause" && isPlaying === true);
        const pauseRequested =
          action === "pause" || (action !== "play" && isPlaying === false);
        if (playRequested) await p.play();
        else if (pauseRequested) await p.pause();
      },
    };
    transportRef.current = transport;
    return () => {
      if (transportRef.current === transport) transportRef.current = null;
    };
  }, [transportRef]);

  const playerWithHistory = useMemo<UsePlayerState>(() => {
    return {
      ...player,
      play: async () => {
        await player.play();
        onTransportRef.current?.("play", snapshotRef.current.position);
      },
      pause: async () => {
        await player.pause();
        onTransportRef.current?.("pause", snapshotRef.current.position);
      },
      togglePause: async () => {
        const wasPaused = player.snapshot.pause;
        await player.togglePause();
        onTransportRef.current?.(
          wasPaused ? "play" : "pause",
          snapshotRef.current.position,
        );
      },
      seek: async (seconds: number, opts?: { personal?: boolean }) => {
        await player.seek(seconds);
        progressRef.current.flush({
          positionSec: seconds,
          durationSec: player.snapshot.duration,
          paused: player.snapshot.pause,
        });
        // Personal skips (intro/recap) stay local — room protocol forbids
        // broadcasting them; host scrubs still send a normal `state`.
        if (!opts?.personal) {
          onTransportRef.current?.("seek", seconds);
        }
      },
    };
  }, [player]);

  // Throttled progress on every snapshot tick.
  const { position, duration, pause } = player.snapshot;
  useEffect(() => {
    historyProgress.track({
      positionSec: position,
      durationSec: duration,
      paused: pause,
    });
    // `track` is stable; snapshot fields drive the ticks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position, duration, pause]);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    void (async () => {
      try {
        const [file, historyStart] = await Promise.all([
          fetchFileUrl(fileId, controller.signal),
          // Explicit startAt (prop / openPlayer) wins; room mode skips resume.
          resumeAt.current != null || roomMode
            ? Promise.resolve(null)
            : fetchResumePosition(fileId, controller.signal),
        ]);
        if (cancelled) return;
        const from = resumeAt.current ?? historyStart;
        await player.start(file.url, { startAt: from });
      } catch (cause) {
        if (cancelled) return;
        const message =
          cause instanceof Error && cause.message
            ? cause.message
            : "Не удалось открыть файл";
        player.fail(message);
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
    // Re-open on retry (`openToken`); `player.fail` is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileId, openToken, roomMode]);

  return (
    <section className="app-fullbleed player-screen">
      <PlayerSurface
        player={{
          ...playerWithHistory,
          retry: () => setOpenToken((token) => token + 1),
        }}
        segments={intro.segments}
        mediaId={intro.context?.mediaId ?? null}
        alreadyReviewed={Boolean(intro.context?.alreadyReviewed)}
      />
    </section>
  );
}

export { openPlayer as openPlayerRoute } from "../features/player";
