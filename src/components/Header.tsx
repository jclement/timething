/**
 * Header — fixed top bar with brand, tagline, and theme toggle.
 * Hidden on print.
 */

import { Monitor, Moon, Sun, Clock } from "lucide-react";
import { useMemo } from "react";
import { useTheme } from "../hooks/useTheme";
import { randomTagline } from "../lib/taglines";

export function Header() {
  const { theme, cycle } = useTheme();
  const tagline = useMemo(() => randomTagline(), []);

  const ThemeIcon = theme === "system" ? Monitor : theme === "light" ? Sun : Moon;

  return (
    <header className="no-print bg-gray-900 text-white h-12 flex items-center px-3 sm:px-5 gap-3">
      <div className="flex items-center gap-2">
        <Clock className="w-5 h-5 text-blue-400" />
        <span className="font-semibold tracking-tight">timething</span>
      </div>
      <span className="hidden md:block text-xs text-gray-400 truncate">{tagline}</span>
      <div className="flex-1" />
      <button
        type="button"
        aria-label={`Theme: ${theme}`}
        onClick={cycle}
        className="h-8 w-8 flex items-center justify-center rounded hover:bg-gray-800 text-gray-300"
      >
        <ThemeIcon className="w-4 h-4" />
      </button>
    </header>
  );
}
