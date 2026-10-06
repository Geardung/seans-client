import { describe, expect, it } from "vitest";
import { formatBytes, formatSpeed } from "../src/lib/format";

describe("formatBytes", () => {
  it("formats bytes below 1 KB as integers", () => {
    expect(formatBytes(0)).toBe("0 Б");
    expect(formatBytes(1)).toBe("1 Б");
    expect(formatBytes(512)).toBe("512 Б");
    expect(formatBytes(1023)).toBe("1023 Б");
  });

  it("scales binary units with one decimal below 100", () => {
    expect(formatBytes(1024)).toBe("1.0 КБ");
    expect(formatBytes(1536)).toBe("1.5 КБ");
    expect(formatBytes(1024 * 1024)).toBe("1.0 МБ");
    expect(formatBytes(1024 * 1024 * 2.5)).toBe("2.5 МБ");
    expect(formatBytes(1024 ** 3)).toBe("1.0 ГБ");
    expect(formatBytes(1024 ** 4)).toBe("1.0 ТБ");
  });

  it("drops the decimal at 100+ in a unit", () => {
    expect(formatBytes(1024 * 150)).toBe("150 КБ");
    expect(formatBytes(1024 * 1024 * 250)).toBe("250 МБ");
  });

  it("treats nullish / non-finite as 0", () => {
    expect(formatBytes(null)).toBe("0 Б");
    expect(formatBytes(undefined)).toBe("0 Б");
    expect(formatBytes(Number.NaN)).toBe("0 Б");
    expect(formatBytes(Number.POSITIVE_INFINITY)).toBe("0 Б");
  });

  it("keeps a minus sign for negative values", () => {
    expect(formatBytes(-2048)).toBe("-2.0 КБ");
  });
});

describe("formatSpeed", () => {
  it("appends a per-second suffix", () => {
    expect(formatSpeed(0)).toBe("0 Б/с");
    expect(formatSpeed(1024)).toBe("1.0 КБ/с");
    expect(formatSpeed(1024 * 1024)).toBe("1.0 МБ/с");
  });

  it("matches formatBytes for the magnitude", () => {
    const n = 5 * 1024 * 1024;
    expect(formatSpeed(n)).toBe(`${formatBytes(n)}/с`);
    expect(formatSpeed(null)).toBe("0 Б/с");
  });
});
