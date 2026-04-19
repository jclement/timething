/**
 * MobileGrid — narrow-viewport layout.
 *
 * On phones a horizontal-hours grid is unreadable. This component flips
 * the axes: zones become columns (up to the screen width, then horizontal
 * scroll), hours stack vertically. The top row is the column headers
 * (city + abbr), each subsequent row is one home-zone hour.
 *
 * Clicking a row highlights that hour across every zone, matching the
 * desktop interaction.
 */

import { Home } from "lucide-react";
import { useMemo } from "react";
import type { WorkingHours, ZoneConfig } from "../lib/storage";
import { computeDayOffset, formatHour } from "../lib/time";
import { firstCityForTz, humanizeIana, zoneAbbreviation } from "../lib/timezones";

const ZONE_COLORS = [
  "#2563eb",
  "#0891b2",
  "#059669",
  "#d97706",
  "#db2777",
  "#7c3aed",
  "#dc2626",
  "#0d9488",
];

interface Props {
  homeTz: string;
  homeLabel?: string;
  referenceDate: string;
  zones: ZoneConfig[]; // includes home at index 0
  defaultWorkingHours: WorkingHours;
  use24h: boolean;
  range: [number, number];
  highlightedHour: number | null;
  onHighlightHour: (h: number | null) => void;
  onEdit: (id: string) => void;
  /** Retained for API compat; remove/rename/workingHours all live in ZoneEditor now. */
  onRemove?: (id: string) => void;
  onRename?: (id: string, label: string) => void;
  onWorkingHoursChange?: (id: string, wh: WorkingHours | undefined) => void;
  overlapHours: Set<number>;
}

export function MobileGrid({
  homeTz,
  homeLabel,
  referenceDate,
  zones,
  defaultWorkingHours,
  use24h,
  range,
  highlightedHour,
  onHighlightHour,
  onEdit,
  overlapHours,
}: Props) {
  const hours = useMemo(() => {
    const out: number[] = [];
    for (let h = range[0]; h < range[1]; h++) out.push(h);
    return out;
  }, [range]);

  // Per-zone cell data computed in one pass — we index by [zoneIdx][hourIdx].
  const grid = useMemo(() => {
    return zones.map((zone) =>
      hours.map((h) => computeDayOffset(homeTz, zone.tz, referenceDate, h)),
    );
  }, [zones, hours, homeTz, referenceDate]);

  const homeHourLabel = (h: number) => {
    if (use24h) return `${h.toString().padStart(2, "0")}:00`;
    if (h === 0) return "12 AM";
    if (h === 12) return "12 PM";
    if (h < 12) return `${h} AM`;
    return `${h - 12} PM`;
  };

  return (
    <div className="bg-surface border border-app rounded-md shadow-sm overflow-x-auto">
      {/* Header row — city names + controls as columns */}
      <div className="flex border-b border-app-strong bg-surface-alt sticky top-0 z-10">
        <div className="w-16 flex-shrink-0 px-2 py-2 border-r border-app text-[10px] uppercase tracking-wider text-muted font-semibold">
          Home
        </div>
        {zones.map((zone, i) => (
          <ColumnHeader
            key={zone.id}
            zone={zone}
            isHome={i === 0}
            homeLabel={homeLabel}
            color={ZONE_COLORS[i % ZONE_COLORS.length]}
            onEdit={() => onEdit(zone.id)}
          />
        ))}
      </div>

      {/* Body — one row per home hour */}
      {hours.map((h, hi) => {
        const highlighted = highlightedHour === h;
        const isOverlap = overlapHours.has(h);
        return (
          <div
            key={h}
            className={`relative flex border-b border-app last:border-b-0 ${
              highlighted ? "bg-selected" : isOverlap ? "bg-[var(--color-success)]/10" : ""
            }`}
          >
            {isOverlap && (
              <span
                aria-hidden="true"
                className="absolute inset-y-0 left-0 w-1 bg-[var(--color-success)]"
              />
            )}
            <button
              type="button"
              onClick={() => onHighlightHour(highlighted ? null : h)}
              className={`w-16 flex-shrink-0 px-2 py-1.5 text-[11px] font-mono tabular-nums border-r border-app text-left focus:outline-none focus:ring-1 focus:ring-inset focus:ring-[var(--color-primary)] ${
                highlighted
                  ? "bg-[var(--color-primary)] text-white"
                  : isOverlap
                    ? "text-[var(--color-success)] font-semibold hover:bg-hover"
                    : "text-subtle hover:bg-hover"
              }`}
            >
              {homeHourLabel(h)}
            </button>
            {zones.map((zone, zi) => {
              const cell = grid[zi][hi];
              const workingHours = zone.workingHours ?? defaultWorkingHours;
              const prev = grid[zi][hi - 1];
              const crossesDay = prev && prev.dayOffset !== cell.dayOffset;
              const inWorking = isWorkingHour(cell.cell.hour, workingHours);
              const color = ZONE_COLORS[zi % ZONE_COLORS.length];
              const dayChip = formatDayChip(cell.dayOffset);

              return (
                <button
                  type="button"
                  key={zone.id}
                  onClick={() => onHighlightHour(highlighted ? null : h)}
                  className={`flex-1 min-w-[72px] px-1 py-1.5 border-r last:border-r-0 border-app ${
                    crossesDay ? "border-t border-t-[var(--color-border-strong)]" : ""
                  } focus:outline-none flex items-center justify-center gap-1`}
                  style={{
                    backgroundColor: highlighted
                      ? hexWithAlpha(color, 0.3)
                      : inWorking
                        ? hexWithAlpha(color, 0.18)
                        : "transparent",
                  }}
                >
                  <span
                    className={`text-xs font-mono tabular-nums ${
                      inWorking ? "text-heading font-semibold" : "text-subtle"
                    }`}
                  >
                    {formatHour(cell.cell.hour, cell.cell.minute, use24h)}
                  </span>
                  {dayChip && (
                    <span
                      className={`text-[9px] leading-none inline-block px-1 py-0.5 rounded-sm font-semibold ${
                        cell.dayOffset > 0
                          ? "bg-amber-200 text-amber-900 dark:bg-amber-500/30 dark:text-amber-100"
                          : "bg-indigo-200 text-indigo-900 dark:bg-indigo-500/30 dark:text-indigo-100"
                      }`}
                    >
                      {dayChip}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Column header — whole cell is the tap target that opens the ZoneEditor.
// Remove, rename, and working-hours changes all happen in the modal, so
// the header just needs to show the name + context and be tappable.
// ---------------------------------------------------------------------------

function ColumnHeader({
  zone,
  isHome,
  homeLabel,
  color,
  onEdit,
}: {
  zone: ZoneConfig;
  isHome: boolean;
  homeLabel?: string;
  color: string;
  onEdit: () => void;
}) {
  const city = firstCityForTz(zone.tz);
  const effectiveLabel = isHome ? (homeLabel ?? zone.label) : zone.label;
  const display = effectiveLabel ?? city?.name ?? humanizeIana(zone.tz);
  const abbr = zoneAbbreviation(zone.tz);

  return (
    <button
      type="button"
      onClick={onEdit}
      aria-label={`Edit ${display}`}
      className="flex-1 min-w-[80px] px-2 py-2 border-r last:border-r-0 border-app text-left hover:bg-hover focus:outline-none focus:ring-1 focus:ring-inset focus:ring-[var(--color-primary)]"
    >
      <div className="flex items-start gap-1.5">
        <span
          aria-hidden="true"
          className="inline-block w-2 h-2 rounded-sm mt-1 flex-shrink-0"
          style={{ background: color }}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1 min-w-0">
            <span className="text-xs font-semibold text-heading truncate">{display}</span>
            {isHome && (
              <Home className="w-3 h-3 text-[var(--color-primary)] flex-shrink-0" />
            )}
          </div>
          <div className="text-[9px] text-muted font-mono truncate">{abbr}</div>
        </div>
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isWorkingHour(hour: number, wh: WorkingHours): boolean {
  if (wh.start <= wh.end) return hour >= wh.start && hour < wh.end;
  return hour >= wh.start || hour < wh.end;
}

function formatDayChip(dayOffset: number): string | null {
  if (dayOffset === 0) return null;
  if (dayOffset > 0) return `+${dayOffset}d`;
  return `${dayOffset}d`;
}

function hexWithAlpha(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
