import { describe, expect, it } from "vitest";
import {
  createInitialRoomState,
  roomReducer,
} from "../src/features/rooms/roomReducer";
import type { RoomAction, RoomState } from "../src/features/rooms/roomReducer";

function apply(actions: RoomAction[], initial?: Partial<RoomState>): RoomState {
  let state = createInitialRoomState(
    initial
      ? {
          members: initial.members?.map((m) => ({
            user_id: m.userId,
            name: m.name,
          })),
          hostId: initial.hostId ?? null,
          status: initial.status ?? "idle",
        }
      : {},
  );
  if (initial && !initial.members) {
    state = { ...state, ...initial, members: state.members };
  }
  for (const action of actions) {
    state = roomReducer(state, action);
  }
  return state;
}

describe("createInitialRoomState", () => {
  it("starts idle with empty room fields", () => {
    const state = createInitialRoomState();
    expect(state.status).toBe("idle");
    expect(state.hostId).toBeNull();
    expect(state.position).toBe(0);
    expect(state.isPlaying).toBe(false);
    expect(state.members).toEqual([]);
    expect(state.error).toBeNull();
    expect(state.closeCode).toBeNull();
  });

  it("seeds REST members and host", () => {
    const state = createInitialRoomState({
      members: [
        { user_id: "u1", name: "Анна" },
        { user_id: "u2" },
      ],
      hostId: "u1",
    });
    expect(state.members).toEqual([
      { userId: "u1", name: "Анна" },
      { userId: "u2", name: null },
    ]);
    expect(state.hostId).toBe("u1");
  });
});

describe("roomReducer lifecycle", () => {
  it("connected clears error and close code", () => {
    const state = apply([
      { type: "error", detail: "boom" },
      { type: "closed", code: 4001 },
      { type: "connected" },
    ]);
    expect(state.status).toBe("connected");
    expect(state.error).toBeNull();
    expect(state.closeCode).toBeNull();
  });

  it("closed stores the close code", () => {
    const state = apply([{ type: "closed", code: 4004 }]);
    expect(state.status).toBe("closed");
    expect(state.closeCode).toBe(4004);
  });

  it("closed tolerates a missing code", () => {
    const state = apply([{ type: "closed", code: null }]);
    expect(state.status).toBe("closed");
    expect(state.closeCode).toBeNull();
  });
});

describe("roomReducer playback frames", () => {
  it("room_state replaces host, position and isPlaying", () => {
    const state = apply([
      {
        type: "room_state",
        hostId: "host-1",
        position: 12.5,
        isPlaying: true,
        ts: 1710000000,
      },
    ]);
    expect(state.hostId).toBe("host-1");
    expect(state.position).toBe(12.5);
    expect(state.isPlaying).toBe(true);
    expect(state.status).toBe("connected");
    expect(state.error).toBeNull();
  });

  it("room_state keeps the previous host when hostId is null", () => {
    const state = apply([
      { type: "room_state", hostId: "host-1", position: 1, isPlaying: false },
      { type: "room_state", hostId: null, position: 2, isPlaying: true },
    ]);
    expect(state.hostId).toBe("host-1");
    expect(state.position).toBe(2);
  });

  it("state play/pause/seek updates position and playing flag", () => {
    let state = apply([
      { type: "state", action: "play", position: 10, by: "host" },
    ]);
    expect(state.isPlaying).toBe(true);
    expect(state.position).toBe(10);

    state = roomReducer(state, {
      type: "state",
      action: "pause",
      position: 11,
      by: "host",
    });
    expect(state.isPlaying).toBe(false);
    expect(state.position).toBe(11);

    state = roomReducer(state, {
      type: "state",
      action: "seek",
      position: 40,
      by: "host",
    });
    // seek keeps the current playing flag
    expect(state.isPlaying).toBe(false);
    expect(state.position).toBe(40);
  });

  it("state clears a previous error", () => {
    const state = apply([
      { type: "error", detail: "Only host can control playback" },
      { type: "state", action: "play", position: 3, by: "host" },
    ]);
    expect(state.error).toBeNull();
  });
});

describe("roomReducer members", () => {
  it("member_joined appends and member_left removes", () => {
    const state = apply([
      { type: "member_joined", user: { user_id: "u1", name: "Анна" } },
      { type: "member_joined", user: { user_id: "u2", name: "Борис" } },
      { type: "member_left", user: { user_id: "u1", name: "Анна" } },
    ]);
    expect(state.members).toEqual([{ userId: "u2", name: "Борис" }]);
  });

  it("member_joined upserts by user_id and keeps the last name", () => {
    const state = apply([
      { type: "member_joined", user: { user_id: "u1", name: "Анна" } },
      { type: "member_joined", user: { user_id: "u1", name: null } },
    ]);
    expect(state.members).toEqual([{ userId: "u1", name: "Анна" }]);
  });

  it("member_left is a no-op for unknown users", () => {
    const state = apply([
      { type: "member_joined", user: { user_id: "u1", name: "Анна" } },
      { type: "member_left", user: { user_id: "ghost" } },
    ]);
    expect(state.members).toHaveLength(1);
  });
});

describe("roomReducer errors", () => {
  it("error keeps the detail text", () => {
    const state = apply([
      { type: "error", detail: "Only host can control playback" },
    ]);
    expect(state.error).toBe("Only host can control playback");
    expect(state.status).toBe("idle");
  });

  it("error falls back for empty detail", () => {
    const state = apply([{ type: "error", detail: "" }]);
    expect(state.error).toBe("Ошибка комнаты");
  });

  it("invalid numeric positions degrade to 0", () => {
    const state = apply([
      {
        type: "room_state",
        hostId: "h",
        position: Number.NaN,
        isPlaying: true,
      },
    ]);
    expect(state.position).toBe(0);
  });
});
