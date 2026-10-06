/**
 * Watch-party helper decisions (M10). Pure — no React/DOM/WS, unit-testable.
 *
 * Covers: host identity, remote-apply policy, share link, close-code copy,
 * WS URL assembly, heartbeat cadence.
 */

/** Heartbeat cadence sent with the local player position (5–10 s per contract). */
export const ROOM_HEARTBEAT_INTERVAL_MS = 7_000;

/** Public web origin used for the share link (not the API host). */
export const ROOM_SHARE_BASE_URL = "https://seans.tedeshi.ru";

/** WS close codes from the room contract. */
export const ROOM_CLOSE_UNAUTHORIZED = 4001;
export const ROOM_CLOSE_NOT_FOUND = 4004;

/** Localized close-code copy for the room UI. */
export function roomCloseMessage(code: number | null | undefined): string {
  if (code === ROOM_CLOSE_UNAUTHORIZED) return "Нет доступа";
  if (code === ROOM_CLOSE_NOT_FOUND) return "Комната не найдена";
  return "Соединение с комнатой закрыто";
}

/** Short display label for a member without a name. */
export function memberLabel(member: {
  userId: string;
  name: string | null;
}): string {
  if (member.name && member.name.length > 0) return member.name;
  const id = member.userId.length > 8 ? member.userId.slice(0, 8) : member.userId;
  return `Участник ${id}`;
}

/** True when `selfId` is the current room host. */
export function isHost(
  hostId: string | number | null | undefined,
  selfId: string | number | null | undefined,
): boolean {
  if (hostId == null || selfId == null) return false;
  const h = String(hostId);
  const s = String(selfId);
  if (h.length === 0 || s.length === 0) return false;
  return h === s;
}

export type RemoteApplyInput = {
  selfUserId: string | number | null | undefined;
  hostUserId: string | number | null | undefined;
  /** `by` field of the frame, when present. */
  byUserId?: string | number | null | undefined;
};

/**
 * Decide whether a remote `state` / `room_state` should move the local player.
 *
 * - Host owns playback: never apply remote (including optional echoes).
 * - Guests apply; ignore frames that claim to be from ourselves.
 */
export function shouldApplyRemoteState(input: RemoteApplyInput): boolean {
  const { selfUserId, hostUserId, byUserId } = input;
  if (isHost(hostUserId, selfUserId)) return false;
  if (
    byUserId != null &&
    selfUserId != null &&
    String(byUserId) === String(selfUserId)
  ) {
    return false;
  }
  return true;
}

/** Share URL copied by the room side panel. */
export function roomShareUrl(code: string): string {
  return `${ROOM_SHARE_BASE_URL.replace(/\/+$/, "")}/room/${code}`;
}

/** Map an API host/base to a ws(s) origin. */
export function toWebSocketBase(apiBaseUrl: string): string {
  const base = apiBaseUrl.replace(/\/+$/, "");
  if (base.startsWith("https://")) return `wss://${base.slice("https://".length)}`;
  if (base.startsWith("http://")) return `ws://${base.slice("http://".length)}`;
  return base;
}

export type BuildRoomWsUrlOptions = {
  code: string;
  /** JWT for `?token=`; omit/empty to leave the query untouched. */
  token?: string | null;
  /** Explicit URL from the API (`room.ws_url`). */
  wsUrl?: string | null;
  /** Fallback base (`https://api.seans.tedeshi.ru` or `ws://localhost:8000`). */
  apiBaseUrl?: string;
};

/**
 * Assemble `wss://…/ws/rooms/{code}?token=<JWT>`.
 * Prefers the server-provided `wsUrl`, otherwise derives it from `apiBaseUrl`.
 */
export function buildRoomWsUrl(options: BuildRoomWsUrlOptions): string {
  const code = encodeURIComponent(options.code);
  let url: string;

  const explicit = options.wsUrl != null && options.wsUrl !== "" ? options.wsUrl : null;
  if (explicit) {
    url = explicit;
  } else {
    const base = toWebSocketBase(options.apiBaseUrl ?? "https://api.seans.tedeshi.ru");
    url = `${base}/ws/rooms/${code}`;
  }

  const token = options.token != null && options.token !== "" ? options.token : null;
  if (token === null) return url;

  try {
    const parsed = new URL(url);
    parsed.searchParams.set("token", token);
    return parsed.toString();
  } catch {
    // Relative/unparseable URL — append the query by hand.
    const sep = url.includes("?") ? "&" : "?";
    return `${url}${sep}token=${encodeURIComponent(token)}`;
  }
}
