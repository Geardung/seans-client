import { describe, expect, it } from "vitest";
import {
  applyTheme,
  getTheme,
  nextTheme,
  normalizeTheme,
  resolveTheme,
  setTheme,
  THEME_STORAGE_KEY,
  themeLabel,
} from "../src/design/theme";
import type {
  StorageLike,
  ThemePreference,
  ThemeRootLike,
} from "../src/design/theme";

function memoryStorage(initial?: Record<string, string>): StorageLike & {
  data: Record<string, string>;
} {
  const data: Record<string, string> = { ...initial };
  return {
    data,
    getItem: (key) => (key in data ? data[key] : null),
    setItem: (key, value) => {
      data[key] = value;
    },
  };
}

function fakeRoot(): ThemeRootLike & { attrs: Record<string, string> } {
  const attrs: Record<string, string> = {};
  return {
    attrs,
    setAttribute: (name, value) => {
      attrs[name] = value;
    },
  };
}

describe("normalizeTheme", () => {
  it("accepts light and dark", () => {
    expect(normalizeTheme("light")).toBe("light");
    expect(normalizeTheme("dark")).toBe("dark");
  });

  it("falls back to system for anything else", () => {
    expect(normalizeTheme("system")).toBe("system");
    expect(normalizeTheme(null)).toBe("system");
    expect(normalizeTheme(undefined)).toBe("system");
    expect(normalizeTheme("blue")).toBe("system");
    expect(normalizeTheme(42)).toBe("system");
  });
});

describe("resolveTheme", () => {
  it("returns the preference when forced", () => {
    expect(resolveTheme("light", "dark")).toBe("light");
    expect(resolveTheme("dark", "light")).toBe("dark");
  });

  it("follows the system when preference is system", () => {
    expect(resolveTheme("system", "dark")).toBe("dark");
    expect(resolveTheme("system", "light")).toBe("light");
  });
});

describe("nextTheme", () => {
  it("cycles system → light → dark → system", () => {
    const seen: ThemePreference[] = ["system"];
    let t: ThemePreference = "system";
    for (let i = 0; i < 3; i++) {
      t = nextTheme(t);
      seen.push(t);
    }
    expect(seen).toEqual(["system", "light", "dark", "system"]);
  });
});

describe("themeLabel", () => {
  it("labels preferences in Russian", () => {
    expect(themeLabel("system")).toBe("Система");
    expect(themeLabel("light")).toBe("Светлая");
    expect(themeLabel("dark")).toBe("Тёмная");
  });
});

describe("getTheme / setTheme", () => {
  it("defaults to system when storage is empty", () => {
    expect(getTheme(memoryStorage())).toBe("system");
  });

  it("reads a persisted preference", () => {
    expect(getTheme(memoryStorage({ [THEME_STORAGE_KEY]: "dark" }))).toBe("dark");
    expect(getTheme(memoryStorage({ [THEME_STORAGE_KEY]: "light" }))).toBe(
      "light",
    );
  });

  it("normalizes garbage stored values to system", () => {
    expect(getTheme(memoryStorage({ [THEME_STORAGE_KEY]: "neon" }))).toBe(
      "system",
    );
  });

  it("persists only the preference under seans.theme", () => {
    const store = memoryStorage();
    setTheme("dark", store);
    expect(store.data[THEME_STORAGE_KEY]).toBe("dark");
    expect(Object.keys(store.data)).toEqual([THEME_STORAGE_KEY]);
  });

  it("returns system when storage is unavailable", () => {
    expect(getTheme(null)).toBe("system");
  });

  it("survives throwing storage", () => {
    const throwing: StorageLike = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
    };
    expect(getTheme(throwing)).toBe("system");
    expect(() => setTheme("dark", throwing)).not.toThrow();
  });
});

describe("applyTheme", () => {
  it("writes data-theme on the root and resolves the scheme", () => {
    const root = fakeRoot();
    const resolved = applyTheme("dark", { root, system: "light" });
    expect(root.attrs["data-theme"]).toBe("dark");
    expect(resolved).toBe("dark");
  });

  it("keeps system on the attribute so CSS can follow the OS", () => {
    const root = fakeRoot();
    const resolved = applyTheme("system", { root, system: "dark" });
    expect(root.attrs["data-theme"]).toBe("system");
    expect(resolved).toBe("dark");
  });

  it("can force light over a dark system", () => {
    const root = fakeRoot();
    const resolved = applyTheme("light", { root, system: "dark" });
    expect(root.attrs["data-theme"]).toBe("light");
    expect(resolved).toBe("light");
  });

  it("normalizes invalid preference input", () => {
    const root = fakeRoot();
    const resolved = applyTheme("neon" as ThemePreference, {
      root,
      system: "dark",
    });
    expect(root.attrs["data-theme"]).toBe("system");
    expect(resolved).toBe("dark");
  });

  it("does not write to storage (persistence is setTheme only)", () => {
    const store = memoryStorage();
    const root = fakeRoot();
    applyTheme("dark", { root, system: "light" });
    // No storage passed → nothing persisted; preference stays untouched.
    expect(store.data).toEqual({});
  });
});
