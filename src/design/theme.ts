/**
 * Theme preference helpers (M3).
 *
 * Preference only (`system | light | dark`) is persisted — never palette tokens.
 * Storage key: `seans.theme`. Applied as `data-theme` on <html>.
 *
 * Pure helpers (`normalizeTheme`, `resolveTheme`, `nextTheme`) are unit-testable
 * without DOM; `getTheme` / `setTheme` / `applyTheme` accept injectable storage/root.
 */

export type ThemePreference = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "seans.theme";

export const THEME_PREFERENCES: readonly ThemePreference[] = [
  "system",
  "light",
  "dark",
];

/** Narrow an unknown storage/JSON value to a valid preference (default: system). */
export function normalizeTheme(raw: unknown): ThemePreference {
  return raw === "light" || raw === "dark" ? raw : "system";
}

/** Resolve a preference against the OS/browser scheme. */
export function resolveTheme(
  preference: ThemePreference,
  system: ResolvedTheme,
): ResolvedTheme {
  return preference === "system" ? system : preference;
}

/** Cycle order used by the nav theme switcher: system → light → dark → system. */
export function nextTheme(preference: ThemePreference): ThemePreference {
  switch (preference) {
    case "system":
      return "light";
    case "light":
      return "dark";
    case "dark":
      return "system";
  }
}

/** Russian labels for user-visible theme controls. */
export function themeLabel(preference: ThemePreference): string {
  switch (preference) {
    case "system":
      return "Система";
    case "light":
      return "Светлая";
    case "dark":
      return "Тёмная";
  }
}

/** Minimal `Storage` surface so tests need no DOM. */
export type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

/** Minimal `document.documentElement` surface so tests need no DOM. */
export type ThemeRootLike = {
  setAttribute(qualifiedName: string, value: string): void;
};

function defaultStorage(): StorageLike | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    // Access to localStorage can throw in some privacy modes.
    return null;
  }
}

function defaultRoot(): ThemeRootLike | null {
  const doc = (globalThis as { document?: { documentElement?: ThemeRootLike } })
    .document;
  return doc?.documentElement ?? null;
}

function readSystemTheme(): ResolvedTheme {
  const mm = (
    globalThis as {
      matchMedia?: (query: string) => { matches: boolean };
    }
  ).matchMedia;
  if (typeof mm === "function") {
    try {
      return mm.call(globalThis, "(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    } catch {
      // fall through
    }
  }
  return "light";
}

/** Read the persisted preference; `system` when unset or storage unavailable. */
export function getTheme(storage?: StorageLike | null): ThemePreference {
  const store = storage ?? defaultStorage();
  if (!store) return "system";
  try {
    return normalizeTheme(store.getItem(THEME_STORAGE_KEY));
  } catch {
    return "system";
  }
}

/** Persist the preference (never palette values). */
export function setTheme(
  theme: ThemePreference,
  storage?: StorageLike | null,
): void {
  const store = storage ?? defaultStorage();
  if (!store) return;
  try {
    store.setItem(THEME_STORAGE_KEY, normalizeTheme(theme));
  } catch {
    // Quota / private mode — preference just won't persist.
  }
}

/**
 * Set `data-theme` on the document root and return the resolved scheme.
 * Does not persist — call `setTheme` for that (keep apply pure of storage).
 */
export function applyTheme(
  preference: ThemePreference,
  options?: {
    root?: ThemeRootLike | null;
    system?: ResolvedTheme;
  },
): ResolvedTheme {
  const pref = normalizeTheme(preference);
  const root = options?.root ?? defaultRoot();
  // Keep "system" on the attribute so CSS can follow prefers-color-scheme live.
  root?.setAttribute("data-theme", pref);
  return resolveTheme(pref, options?.system ?? readSystemTheme());
}
