/**
 * Player feature barrel (M7). Pure helpers live in `playerHelpers` (unit-tested).
 */

export { PlayerSurface } from "./PlayerSurface";
export { PlayerControls } from "./PlayerControls";
export {
  applySeekDelta,
  clampSeek,
  clampSpeed,
  formatHwdec,
  formatTime,
  formatTrackId,
  formatTrackLabel,
  MAX_SPEED,
  MIN_SPEED,
  OVERLAY_IDLE_MS,
  parseTrackId,
  positionPercent,
  ratioToPosition,
  SEEK_STEP_SEC,
  SPEED_OPTIONS,
} from "./playerHelpers";
export {
  DEFAULT_SNAPSHOT,
  normalizeSnapshot,
  PLAYER_STATE_EVENT,
} from "./playerTypes";
export type { PlayerPhase, PlayerSnapshot, PlayerTrack } from "./playerTypes";
export {
  openPlayerUrl,
  playerDestroy,
  playerGetState,
  playerListTracks,
  playerPause,
  playerPlay,
  playerSeek,
  playerSetAudioTrack,
  playerSetFullscreen,
  playerSetMute,
  playerSetSpeed,
  playerSetSubtitleTrack,
  playerSetVolume,
  playerSyncSize,
  playerToggleFullscreen,
  playerTogglePause,
} from "./playerApi";
export type { OpenPlayerOptions } from "./playerApi";
export {
  consumeStartAt,
  openPlayer,
  PLAYER_START_AT_KEY,
} from "./playerNav";
export type { OpenPlayerNavOptions } from "./playerNav";
export { usePlayer } from "./usePlayer";
export type { UsePlayerState } from "./usePlayer";
