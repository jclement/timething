/**
 * localStorage-backed settings store.
 *
 * We keep all settings under a single JSON blob at a versioned key so
 * future schema changes can migrate cleanly. The hook in
 * hooks/useSettings.ts wraps this with React state.
 */

import { browserTimezone } from "./timezones";

export interface WorkingHours {
  /** Start hour, 0-23. Cells >= start are highlighted until < end. */
  start: number;
  /** End hour, 0-23 (exclusive). */
  end: number;
}

export interface ZoneConfig {
  /** Stable id for React keys and drag/reorder. */
  id: string;
  /** IANA zone. */
  tz: string;
  /** Optional label override — defaults to city lookup. */
  label?: string;
  /** Per-zone working hours override. */
  workingHours?: WorkingHours;
}

export type RangePreset = "work" | "waking" | "full";

export interface Settings {
  /** Schema version — bump when making breaking changes. */
  version: 1;
  /** The user's primary zone, pinned at the top. */
  homeTz: string;
  /** Optional display label for the home zone — user can rename to "Jeff". */
  homeLabel?: string;
  /** Additional zones, in display order. */
  zones: ZoneConfig[];
  /** Default working hours, applied to any zone without an override. */
  defaultWorkingHours: WorkingHours;
  /** Use 24h time format (false = 12h AM/PM). */
  use24h: boolean;
  /** theme preference — system, light, or dark. */
  theme: "system" | "light" | "dark";
  /** Which hour range preset is active. */
  rangeKey: RangePreset;
}

const STORAGE_KEY = "timething:settings:v1";
const THEME_KEY = "timething:theme";

export function defaultSettings(): Settings {
  const homeTz = browserTimezone();
  return {
    version: 1,
    homeTz,
    zones: [],
    defaultWorkingHours: { start: 8, end: 17 },
    use24h: false,
    theme: "system",
    rangeKey: "waking",
  };
}

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultSettings();
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return { ...defaultSettings(), ...parsed, version: 1 };
  } catch {
    return defaultSettings();
  }
}

export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Quota exceeded or disabled storage — swallow, the app still works
    // in memory for the session.
  }
}

export function loadTheme(): "system" | "light" | "dark" {
  try {
    const v = localStorage.getItem(THEME_KEY);
    if (v === "light" || v === "dark" || v === "system") return v;
  } catch {
    // ignore
  }
  return "system";
}

export function saveTheme(theme: "system" | "light" | "dark"): void {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // ignore
  }
}
