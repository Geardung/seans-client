/**
 * Pure watch-party room state machine (M10). No React/DOM/WS — unit-testable.
 *
 * Feeds on normalized server frames (see `roomMessages`) plus socket lifecycle
 * actions (`connected`, `closed`). Guests apply `state` / `room_state` to the
 * player; the reducer itself only mirrors the room so the UI can render it.
 */

export type RoomStatus = "idle" | "connecting" | "connected" | "closed";

export type RoomPlaybackAction = "play" | "pause" | "seek";

export type RoomMember = {
  userId: string;
  name: string | null;
};

export type RoomState = {
  status: RoomStatus;
  /** Current host user id (null until the first `room_state` / REST seed). */
  hostId: string | null;
  /** Room playback position in seconds. */
  position: number;
  isPlaying: boolean;
  members: RoomMember[];
  /** Last server/local error, cleared on the next successful sync. */
  error: string | null;
  /** WS close code when `status` is `closed`. */
  closeCode: number | null;
};

export type RoomAction =
  | { type: "connected" }
  | {
      type: "room_state";
      hostId: string | null;
      position: number;
      isPlaying: boolean;
      ts?: number | null;
    }
  | {
      type: "state";
      action: RoomPlaybackAction;
      position: number;
      by: string | null;
    }
  | { type: "member_joined"; user: { user_id: string; name?: string | null } }
  | { type: "member_left"; user: { user_id: string; name?: string | null } }
  | { type: "error"; detail: string }
  | { type: "closed"; code: number | null };

export function createInitialRoomState(
  options: {
    members?: Array<{ user_id: string; name?: string | null }>;
    hostId?: string | null;
    status?: RoomStatus;
  } = {},
): RoomState {
  return {
    status: options.status ?? "idle",
    hostId: options.hostId ?? null,
    position: 0,
    isPlaying: false,
    members: (options.members ?? []).map((m) => ({
      userId: String(m.user_id),
      name: m.name != null && m.name !== "" ? m.name : null,
    })),
    error: null,
    closeCode: null,
  };
}

function upsertMember(
  members: RoomMember[],
  user: { user_id: string; name?: string | null },
): RoomMember[] {
  const userId = String(user.user_id);
  const name = user.name != null && user.name !== "" ? user.name : null;
  const index = members.findIndex((m) => m.userId === userId);
  if (index < 0) {
    return [...members, { userId, name }];
  }
  const next = members.slice();
  const existing = next[index];
  next[index] = {
    userId,
    // Prefer the freshest non-empty name (WS frames carry display names).
    name: name ?? existing.name,
  };
  return next;
}

function removeMember(members: RoomMember[], user: { user_id: string }): RoomMember[] {
  const userId = String(user.user_id);
  return members.filter((m) => m.userId !== userId);
}

function num(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

/**
 * Reduce one room action. Pure and total: unknown/partial payloads degrade to
 * safe defaults rather than throwing.
 */
export function roomReducer(state: RoomState, action: RoomAction): RoomState {
  switch (action.type) {
    case "connected":
      return {
        ...state,
        status: "connected",
        error: null,
        closeCode: null,
      };

    case "room_state":
      return {
        ...state,
        status: state.status === "closed" ? state.status : "connected",
        hostId: action.hostId != null ? String(action.hostId) : state.hostId,
        position: num(action.position),
        isPlaying: Boolean(action.isPlaying),
        error: null,
      };

    case "state": {
      const position = num(action.position);
      const isPlaying =
        action.action === "play"
          ? true
          : action.action === "pause"
            ? false
            : state.isPlaying;
      return {
        ...state,
        position,
        isPlaying,
        error: null,
      };
    }

    case "member_joined":
      return {
        ...state,
        members: upsertMember(state.members, action.user),
      };

    case "member_left":
      return {
        ...state,
        members: removeMember(state.members, action.user),
      };

    case "error":
      return {
        ...state,
        error:
          typeof action.detail === "string" && action.detail.length > 0
            ? action.detail
            : "Ошибка комнаты",
      };

    case "closed":
      return {
        ...state,
        status: "closed",
        closeCode: typeof action.code === "number" ? action.code : null,
      };

    default:
      return state;
  }
}
