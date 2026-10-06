import { describe, expect, it } from "vitest";
import {
  applySeekDelta,
  clampSeek,
  clampSpeed,
  formatHwdec,
  formatTime,
  formatTrackId,
  formatTrackLabel,
  MAX_SPEED,
  MIN_SPEED,
  parseTrackId,
  positionPercent,
  ratioToPosition,
  SPEED_OPTIONS,
} from "../src/features/player/playerHelpers";
import {
  DEFAULT_SNAPSHOT,
  normalizeSnapshot,
} from "../src/features/player/playerTypes";

describe("formatTime", () => {
  it("renders m:ss below one hour", () => {
    expect(formatTime(0)).toBe("0:00");
    expect(formatTime(5)).toBe("0:05");
    expect(formatTime(65)).toBe("1:05");
    expect(formatTime(600)).toBe("10:00");
    expect(formatTime(3599)).toBe("59:59");
  });

  it("renders h:mm:ss from one hour", () => {
    expect(formatTime(3600)).toBe("1:00:00");
    expect(formatTime(3661)).toBe("1:01:01");
    expect(formatTime(36000)).toBe("10:00:00");
  });

  it("truncates fractional seconds", () => {
    expect(formatTime(65.9)).toBe("1:05");
  });

  it("treats nullish / non-finite / negative as 0:00", () => {
    expect(formatTime(null)).toBe("0:00");
    expect(formatTime(undefined)).toBe("0:00");
    expect(formatTime(Number.NaN)).toBe("0:00");
    expect(formatTime(-12)).toBe("0:00");
  });
});

describe("clampSpeed", () => {
  it("clamps into 0.25–2.0", () => {
    expect(clampSpeed(0.1)).toBe(MIN_SPEED);
    expect(clampSpeed(0.25)).toBe(0.25);
    expect(clampSpeed(1)).toBe(1);
    expect(clampSpeed(2)).toBe(2);
    expect(clampSpeed(5)).toBe(MAX_SPEED);
  });

  it("maps non-finite to 1.0", () => {
    expect(clampSpeed(null)).toBe(1);
    expect(clampSpeed(undefined)).toBe(1);
    expect(clampSpeed(Number.NaN)).toBe(1);
  });

  it("keeps the UI option list inside the product range", () => {
    for (const speed of SPEED_OPTIONS) {
      expect(speed).toBeGreaterThanOrEqual(MIN_SPEED);
      expect(speed).toBeLessThanOrEqual(MAX_SPEED);
      expect(clampSpeed(speed)).toBe(speed);
    }
  });
});

describe("clampSeek", () => {
  it("clamps absolute seeks into [0, duration]", () => {
    expect(clampSeek(-5, 100)).toBe(0);
    expect(clampSeek(50, 100)).toBe(50);
    expect(clampSeek(150, 100)).toBe(100);
    expect(clampSeek(0, 100)).toBe(0);
    expect(clampSeek(100, 100)).toBe(100);
  });

  it("only floors at 0 when duration is unknown", () => {
    expect(clampSeek(-1, 0)).toBe(0);
    expect(clampSeek(9999, 0)).toBe(9999);
    expect(clampSeek(42, null)).toBe(42);
  });

  it("treats non-finite seconds as 0", () => {
    expect(clampSeek(Number.NaN, 100)).toBe(0);
    expect(clampSeek(null, 100)).toBe(0);
    expect(clampSeek(undefined, 100)).toBe(0);
  });
});

describe("applySeekDelta", () => {
  it("shifts position by ±5s and clamps", () => {
    expect(applySeekDelta(10, 5, 100)).toBe(15);
    expect(applySeekDelta(10, -5, 100)).toBe(5);
    expect(applySeekDelta(2, -5, 100)).toBe(0);
    expect(applySeekDelta(98, 5, 100)).toBe(100);
  });
});

describe("formatTrackId / parseTrackId", () => {
  it("formats kind:id select values", () => {
    expect(formatTrackId("audio", 1)).toBe("audio:1");
    expect(formatTrackId("sub", 3)).toBe("sub:3");
  });

  it("normalizes invalid ids to 0 (off)", () => {
    expect(formatTrackId("audio", 0)).toBe("audio:0");
    expect(formatTrackId("audio", -2)).toBe("audio:0");
    expect(formatTrackId("audio", null)).toBe("audio:0");
    expect(formatTrackId("audio", Number.NaN)).toBe("audio:0");
    expect(formatTrackId("", 2)).toBe("track:2");
  });

  it("round-trips through parseTrackId", () => {
    expect(parseTrackId("audio:1")).toEqual({ kind: "audio", id: 1 });
    expect(parseTrackId("sub:0")).toEqual({ kind: "sub", id: 0 });
    expect(parseTrackId("audio:")).toEqual({ kind: "audio", id: 0 });
    expect(parseTrackId("bogus")).toEqual({ kind: "bogus", id: 0 });
  });
});

describe("formatTrackLabel", () => {
  it("builds Russian labels with lang and title", () => {
    expect(
      formatTrackLabel({ kind: "audio", id: 2, lang: "rus", title: "Дубляж", codec: "aac" }),
    ).toBe("Аудио 2 · rus · Дубляж");
  });

  it("falls back to codec when title is empty", () => {
    expect(formatTrackLabel({ kind: "sub", id: 1, lang: "eng", codec: "ass" })).toBe(
      "Субтитры 1 · eng · ASS",
    );
  });

  it("prefixes unknown kinds as «Дорожка»", () => {
    expect(formatTrackLabel({ kind: "video", id: 1 })).toBe("Дорожка 1");
  });
});

describe("formatHwdec", () => {
  it("renders software decode and active hwdec", () => {
    expect(formatHwdec("no")).toBe("программное декодирование");
    expect(formatHwdec(null)).toBe("программное декодирование");
    expect(formatHwdec("d3d11va")).toBe("ускорение: d3d11va");
  });
});

describe("positionPercent / ratioToPosition", () => {
  it("maps position to 0–100 percent", () => {
    expect(positionPercent(30, 120)).toBe(25);
    expect(positionPercent(0, 120)).toBe(0);
    expect(positionPercent(120, 120)).toBe(100);
    expect(positionPercent(50, 0)).toBe(0);
    expect(positionPercent(null, 120)).toBe(0);
  });

  it("maps bar ratio to absolute seconds", () => {
    expect(ratioToPosition(0.5, 100)).toBe(50);
    expect(ratioToPosition(-1, 100)).toBe(0);
    expect(ratioToPosition(2, 100)).toBe(100);
    expect(ratioToPosition(0.5, 0)).toBe(0);
  });
});

describe("normalizeSnapshot", () => {
  it("fills defaults for empty payloads", () => {
    expect(normalizeSnapshot(undefined)).toEqual(DEFAULT_SNAPSHOT);
    expect(normalizeSnapshot(null)).toEqual(DEFAULT_SNAPSHOT);
    expect(normalizeSnapshot({})).toEqual(DEFAULT_SNAPSHOT);
  });

  it("coerces numbers and keeps error strings", () => {
    const snap = normalizeSnapshot({
      position: "12",
      duration: 120,
      pause: false,
      error: "Не удалось открыть файл",
      tracks: [{ id: 1, kind: "audio", selected: true }],
      hwdec: "d3d11va",
    });
    expect(snap.position).toBe(0); // string is not a number → default
    expect(snap.duration).toBe(120);
    expect(snap.pause).toBe(false);
    expect(snap.error).toBe("Не удалось открыть файл");
    expect(snap.tracks).toHaveLength(1);
    expect(snap.tracks[0].kind).toBe("audio");
    expect(snap.hwdec).toBe("d3d11va");
  });

  it("drops empty error strings to null", () => {
    expect(normalizeSnapshot({ error: "" }).error).toBeNull();
    expect(normalizeSnapshot({ error: 42 }).error).toBeNull();
  });
});
