/**
 * Player navigation (M7). Pure-ish helpers — the route hash stays
 * `#/player/:fileId` (`matchPlayerRoute` contract unchanged).
 */

export type OpenPlayerNavOptions = {
  /** Resume position in seconds (M9 history will pass `position_sec`). */
  startAt?: number | null;
};

/** sessionStorage key used to hand `startAt` to PlayerScreen on mount. */
export const PLAYER_START_AT_KEY = "seans.player.startAt";

/**
 * Navigate to the player for `fileId` with an optional resume position.
 *
 * Clean M9 hook: `openPlayer(file.id, { startAt: history.position_sec })`.
 * `startAt` is stashed in sessionStorage so the hash route shape stays
 * `#/player/:fileId`.
 */
export function openPlayer(
  fileId: string | number,
  options: OpenPlayerNavOptions = {},
): void {
  if (typeof window === "undefined") return;
  const start = options.startAt;
  if (start != null && Number.isFinite(start) && start > 0) {
    try {
      window.sessionStorage.setItem(PLAYER_START_AT_KEY, String(start));
    } catch {
      // resume is best-effort
    }
  } else {
    try {
      window.sessionStorage.removeItem(PLAYER_START_AT_KEY);
    } catch {
      // ignore
    }
  }
  const hash = `#/player/${fileId}`;
  if (window.location.hash !== hash) {
    window.location.hash = hash;
  } else {
    // Same route: notify listeners so a remount can pick up startAt.
    window.dispatchEvent(new CustomEvent("seans:player-open"));
  }
}

/**
 * Read and clear a stashed resume position. Returns `null` when absent.
 * Called once per PlayerScreen mount.
 */
export function consumeStartAt(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(PLAYER_START_AT_KEY);
    if (raw == null) return null;
    window.sessionStorage.removeItem(PLAYER_START_AT_KEY);
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  } catch {
    return null;
  }
}
