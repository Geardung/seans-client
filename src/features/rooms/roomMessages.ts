/**
 * Watch-party WS message encode/parse (M10). Pure — no sockets, unit-testable.
 *
 * Client→server: join / heartbeat / state / sync_request / leave.
 * Server→client: room_state / state / member_joined / member_left / error.
 * Parsing is tolerant of unknown fields and partial payloads.
 */

import type { RoomPlaybackAction } from "./roomReducer";

/* ---------------------------------------------------------- client → server */

export type ClientRoomMessage =
  | { type: "join" }
  | { type: "heartbeat"; position: number }
  | { type: "state"; action: RoomPlaybackAction; position: number }
  | { type: "sync_request" }
  | { type: "leave" };

/** Serialize a client frame. Position is clamped to a finite ≥ 0 number. */
export function encodeRoomMessage(message: ClientRoomMessage): string {
  switch (message.type) {
    case "join":
    case "sync_request":
    case "leave":
      return JSON.stringify({ type: message.type });
    case "heartbeat":
      return JSON.stringify({
        type: "heartbeat",
        position: safePosition(message.position),
      });
    case "state":
      return JSON.stringify({
        type: "state",
        action: normalizeAction(message.action) ?? "seek",
        position: safePosition(message.position),
      });
    default:
      return JSON.stringify({ type: "join" });
  }
}

export function encodeJoin(): string {
  return encodeRoomMessage({ type: "join" });
}

export function encodeHeartbeat(position: number): string {
  return encodeRoomMessage({ type: "heartbeat", position });
}

export function encodeState(
  action: RoomPlaybackAction,
  position: number,
): string {
  return encodeRoomMessage({ type: "state", action, position });
}

export function encodeSyncRequest(): string {
  return encodeRoomMessage({ type: "sync_request" });
}

export function encodeLeave(): string {
  return encodeRoomMessage({ type: "leave" });
}

/* ---------------------------------------------------------- server → client */

export type ServerRoomMessage =
  | {
      type: "room_state";
      hostId: string | null;
      position: number;
      isPlaying: boolean;
      ts: number | null;
    }
  | {
      type: "state";
      action: RoomPlaybackAction;
      position: number;
      by: string | null;
    }
  | { type: "member_joined"; userId: string; name: string | null }
  | { type: "member_left"; userId: string; name: string | null }
  | { type: "error"; detail: string };

type Raw = Record<string, unknown>;

function asRaw(value: unknown): Raw {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Raw)
    : {};
}

function safePosition(value: unknown): number {
  let n = 0;
  if (typeof value === "number" && Number.isFinite(value)) {
    n = value;
  } else if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    n = Number.isFinite(parsed) ? parsed : 0;
  }
  return n < 0 ? 0 : n;
}

function str(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return null;
}

function nonEmpty(value: unknown): string | null {
  const s = str(value);
  return s !== null && s.length > 0 ? s : null;
}

function normalizeAction(value: unknown): RoomPlaybackAction | null {
  return value === "play" || value === "pause" || value === "seek" ? value : null;
}

function normalizeBool(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const t = value.trim().toLowerCase();
    return t === "true" || t === "1" || t === "yes";
  }
  return false;
}

function normalizeTs(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * Parse one server frame. Returns null for non-JSON, unknown `type`, or
 * payloads missing the identity fields required by that type.
 */
export function parseRoomMessage(raw: string): ServerRoomMessage | null {
  if (typeof raw !== "string" || raw.length === 0) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  const r = asRaw(parsed);
  const type = nonEmpty(r.type);
  if (type === null) return null;

  switch (type) {
    case "room_state":
      return {
        type: "room_state",
        hostId: nonEmpty(r.host_id),
        position: safePosition(r.position),
        isPlaying: normalizeBool(r.is_playing),
        ts: normalizeTs(r.ts),
      };

    case "state": {
      const action = normalizeAction(r.action);
      if (action === null) return null;
      return {
        type: "state",
        action,
        position: safePosition(r.position),
        by: nonEmpty(r.by),
      };
    }

    case "member_joined":
    case "member_left": {
      const userRaw = asRaw(r.user);
      const userId = nonEmpty(userRaw.user_id) ?? nonEmpty(r.user_id);
      if (userId === null) return null;
      return {
        type,
        userId,
        name: nonEmpty(userRaw.name) ?? nonEmpty(r.name),
      };
    }

    case "error":
      return {
        type: "error",
        detail: nonEmpty(r.detail) ?? nonEmpty(r.message) ?? "Ошибка комнаты",
      };

    default:
      return null;
  }
}

/** Map a parsed server frame onto the pure reducer action shape. */
export function serverMessageToAction(
  message: ServerRoomMessage,
):
  | { type: "room_state"; hostId: string | null; position: number; isPlaying: boolean; ts: number | null }
  | { type: "state"; action: RoomPlaybackAction; position: number; by: string | null }
  | { type: "member_joined"; user: { user_id: string; name: string | null } }
  | { type: "member_left"; user: { user_id: string; name: string | null } }
  | { type: "error"; detail: string } {
  switch (message.type) {
    case "room_state":
      return {
        type: "room_state",
        hostId: message.hostId,
        position: message.position,
        isPlaying: message.isPlaying,
        ts: message.ts,
      };
    case "state":
      return {
        type: "state",
        action: message.action,
        position: message.position,
        by: message.by,
      };
    case "member_joined":
    case "member_left":
      return {
        type: message.type,
        user: { user_id: message.userId, name: message.name },
      };
    case "error":
      return { type: "error", detail: message.detail };
  }
}
