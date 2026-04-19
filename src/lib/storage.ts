/**
 * Settings + localStorage persistence.
 *
 * Every zone is equal. The first zone in the list is the "primary" one
 * whose hour axis drives the grid — reorder to change which zone is
 * primary. Working hours are per-zone and always explicit; new zones
 * start at 8–17 (DEFAULT_WORKING_HOURS) and the user tweaks from there.
 */

import { browserTimezone } from "./timezones";

export interface WorkingHours {
  /** Start hour, 0-23. */
  start: number;
  /** End hour, 1-24 (exclusive). */
  end: number;
}

export interface ZoneConfig {
  /** Stable id for React keys and drag/reorder. */
  id: string;
  /** IANA zone. */
  tz: string;
  /** Optional display label override — defaults to the first curated city. */
  label?: string;
  /** Per-zone working hours. Always explicit. */
  workingHours: WorkingHours;
}

export type RangePreset = "work" | "waking" | "full";

export interface Settings {
  /** Schema version — bump when making breaking changes. */
  version: 2;
  /** All zones, in display order. The first one drives the hour axis. */
  zones: ZoneConfig[];
  /** Use 24h time format (false = 12h AM/PM). */
  use24h: boolean;
  /** theme preference — system, light, or dark. */
  theme: "system" | "light" | "dark";
  /** Which hour range preset is active. */
  rangeKey: RangePreset;
  /** Optional page title override. Falls back to a comma-joined zone list. */
  title?: string;
}

const STORAGE_KEY = "timething:settings:v2";
const THEME_KEY = "timething:theme";

/** Hard-coded default working hours for new zones (8am–5pm). */
export const DEFAULT_WORKING_HOURS: WorkingHours = { start: 8, end: 17 };

export function defaultSettings(): Settings {
  return {
    version: 2,
    zones: [makeZone(browserTimezone())],
    use24h: false,
    theme: "system",
    rangeKey: "waking",
  };
}

/**
 * Create a new zone config with sane defaults. `label` is optional — if
 * omitted, rendering falls back to the first curated city for the tz.
 */
export function makeZone(tz: string, label?: string): ZoneConfig {
  return {
    id:
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    tz,
    label,
    workingHours: { ...DEFAULT_WORKING_HOURS },
  };
}

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultSettings();
    const parsed = JSON.parse(raw) as Partial<Settings>;
    if (!parsed || parsed.version !== 2 || !Array.isArray(parsed.zones) || parsed.zones.length === 0) {
      return defaultSettings();
    }
    return { ...defaultSettings(), ...(parsed as Settings), version: 2 };
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
