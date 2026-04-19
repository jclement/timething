/**
 * useTheme — three-state theme cycle (system / light / dark) applied to
 * <html>. The FOUC script in index.html reads localStorage before React
 * boots so the first paint already has the right class.
 */

import { useCallback, useEffect, useState } from "react";
import { loadTheme, saveTheme } from "../lib/storage";

type Theme = "system" | "light" | "dark";

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => loadTheme());

  const apply = useCallback((t: Theme) => {
    const dark =
      t === "dark" || (t === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", dark);
  }, []);

  useEffect(() => {
    apply(theme);
    saveTheme(theme);

    if (theme !== "system") return;
    // Respond to OS changes only while in "system" mode.
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => apply("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme, apply]);

  const cycle = useCallback(() => {
    setThemeState((t) => (t === "system" ? "light" : t === "light" ? "dark" : "system"));
  }, []);

  return { theme, cycle };
}
