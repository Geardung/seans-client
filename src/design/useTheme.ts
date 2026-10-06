import { useCallback, useEffect, useState } from "react";
import {
  applyTheme,
  getTheme,
  nextTheme,
  setTheme,
} from "./theme";
import type { ThemePreference } from "./theme";

/** React binding for the theme preference (M3). */
export function useThemePreference(): {
  preference: ThemePreference;
  cycle: () => void;
} {
  const [preference, setPreference] = useState<ThemePreference>(() => getTheme());

  useEffect(() => {
    setTheme(preference);
    applyTheme(preference);
  }, [preference]);

  const cycle = useCallback(() => {
    setPreference((current) => nextTheme(current));
  }, []);

  return { preference, cycle };
}
