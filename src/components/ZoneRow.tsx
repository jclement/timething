/**
 * ZoneRow — one zone's line of hour cells plus the label column.
 *
 * The label lives in a sticky-left cell so it stays visible while the
 * user scrolls the hour grid horizontally. Every row is equivalent —
 * the first in the grid drives the hour axis, but this component
 * doesn't need to know that.
 *
 * Cell backgrounds follow a three-step intensity on the zone color:
 *   - no tint          for off-hours
 *   - ~15% zone color  for working hours
 *   - ~30% zone color  for overlap hours (every zone is working)
 *   - ~45% zone color  for the clicked/highlighted column
 */

import { Pencil, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { computeDayOffset, formatHour, instantFromHomeHour } from "../lib/time";
import type { WorkingHours, ZoneConfig } from "../lib/storage";
import { firstCityForTz, humanizeIana, zoneAbbreviation } from "../lib/timezones";

interface Props {
  /** IANA zone of the row that drives the hour axis (zones[0]). */
  primaryTz: string;
  referenceDate: string;
  zone: ZoneConfig;
  /** Color swatch index — stable across re-renders by config. */
  colorIndex: number;
  use24h: boolean;
  highlightedHomeHour: number | null;
  onHighlightHour: (hour: number | null) => void;
  onRemove?: () => void;
  onEdit?: () => void;
  onRename?: (label: string) => void;
  /** Hour range to show; start inclusive, end exclusive. */
  range: [number, number];
  /** Primary-zone hours where every zone is inside working hours. */
  overlapHours: Set<number>;
  /** Optional drag handle (rendered at the start of the label). */
  dragHandle?: ReactNode;
}

export function ZoneRow({
  primaryTz,
  referenceDate,
  zone,
  colorIndex,
  use24h,
  highlightedHomeHour,
  onHighlightHour,
  onRemove,
  onEdit,
  onRename,
  range,
  overlapHours,
  dragHandle,
}: Props) {
  const cells = useMemo(() => {
    const out: Array<ReturnType<typeof computeDayOffset> & { homeHour: number }> = [];
    for (let h = range[0]; h < range[1]; h++) {
      const c = computeDayOffset(primaryTz, zone.tz, referenceDate, h);
      out.push({ ...c, homeHour: h });
    }
    return out;
  }, [primaryTz, zone.tz, referenceDate, range]);

  const city = firstCityForTz(zone.tz);
  const display = zone.label ?? city?.name ?? humanizeIana(zone.tz);
  const country = city?.country;
  // Use a moment on the reference date (not today) so the offset
  // label reflects the date the user is viewing — DC shows UTC-5 (EST)
  // in January, UTC-4 (EDT) in July.
  const refInstant = useMemo(
    () => instantFromHomeHour(primaryTz, referenceDate, 12),
    [primaryTz, referenceDate],
  );
  const abbr = zoneAbbreviation(zone.tz, refInstant);

  return (
    <div
      className="grid grid-cols-[minmax(180px,240px)_1fr] border-b border-app print-keep"
      style={{ ["--zone-color" as string]: `var(--zone-${colorIndex % 8})` }}
    >
      <ZoneLabel
        display={display}
        country={country}
        abbr={abbr}
        colorIndex={colorIndex}
        onEdit={onEdit}
        onRemove={onRemove}
        onRename={onRename}
        dragHandle={dragHandle}
      />

      <HourStrip
        cells={cells}
        workingHours={zone.workingHours}
        highlightedHomeHour={highlightedHomeHour}
        onHighlightHour={onHighlightHour}
        use24h={use24h}
        overlapHours={overlapHours}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ZoneLabel({
  display,
  country,
  abbr,
  colorIndex,
  onEdit,
  onRemove,
  onRename,
  dragHandle,
}: {
  display: string;
  country?: string;
  abbr: string;
  colorIndex: number;
  onEdit?: () => void;
  onRemove?: () => void;
  onRename?: (label: string) => void;
  dragHandle?: ReactNode;
}) {
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(display);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!renaming) setDraft(display);
  }, [display, renaming]);

  useEffect(() => {
    if (!renaming) return;
    // focus + select so keyboard users land in the input and overwriting
    // is one keystroke.
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [renaming]);

  const startRename = () => {
    if (!onRename) return;
    setDraft(display);
    setRenaming(true);
  };

  const commit = () => {
    if (onRename) onRename(draft);
    setRenaming(false);
  };

  return (
    <div className="sticky left-0 z-10 bg-surface border-r border-app pl-1 pr-3 py-2 flex items-start gap-1 min-w-0">
      {dragHandle ?? <div className="w-5" aria-hidden="true" />}
      <span
        aria-hidden="true"
        className="inline-block w-2.5 h-2.5 rounded-sm flex-shrink-0 mt-1.5"
        style={{ background: `var(--zone-${colorIndex % 8})` }}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1 min-w-0">
          {renaming ? (
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commit();
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  setRenaming(false);
                }
              }}
              className="flex-1 min-w-0 h-6 px-1 text-sm font-semibold text-heading bg-transparent border-b border-[var(--color-primary)] outline-none"
              aria-label="Zone name"
            />
          ) : (
            <button
              type="button"
              onClick={startRename}
              onDoubleClick={startRename}
              className="min-w-0 flex-1 text-left text-sm font-semibold text-heading truncate hover:underline decoration-dotted"
              title={display}
            >
              {display}
            </button>
          )}
          <div className="no-print flex items-center gap-0.5 flex-shrink-0">
            {onEdit && (
              <button
                type="button"
                aria-label="Edit zone"
                onClick={onEdit}
                className="h-6 w-6 flex items-center justify-center text-muted hover:text-body hover:bg-hover rounded"
                title="Edit zone"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}
            {onRemove && (
              <button
                type="button"
                aria-label="Remove zone"
                onClick={onRemove}
                className="h-6 w-6 flex items-center justify-center text-muted hover:text-[var(--color-danger)] hover:bg-hover rounded"
                title="Remove"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
        <div className="text-[11px] text-muted truncate mt-0.5">
          {country ? <>{country} · </> : null}
          <span className="font-mono">{abbr}</span>
        </div>
      </div>
    </div>
  );
}

function HourStrip({
  cells,
  workingHours,
  highlightedHomeHour,
  onHighlightHour,
  use24h,
  overlapHours,
}: {
  cells: Array<ReturnType<typeof computeDayOffset> & { homeHour: number }>;
  workingHours: WorkingHours;
  highlightedHomeHour: number | null;
  onHighlightHour: (hour: number | null) => void;
  use24h: boolean;
  overlapHours: Set<number>;
}) {
  return (
    <div
      className="grid"
      style={{ gridTemplateColumns: `repeat(${cells.length}, minmax(44px, 1fr))` }}
    >
      {cells.map((cell, i) => {
        const prev = cells[i - 1];
        const crossesDay = prev && prev.dayOffset !== cell.dayOffset;
        const inWorkingHours = isWorkingHour(cell.cell.hour, workingHours);
        const highlighted = highlightedHomeHour === cell.homeHour;
        const isOverlap = overlapHours.has(cell.homeHour);
        const dayChip = formatDayChip(cell.dayOffset);

        return (
          <button
            type="button"
            key={i}
            onClick={() =>
              onHighlightHour(highlightedHomeHour === cell.homeHour ? null : cell.homeHour)
            }
            className={`relative h-14 border-l first:border-l-0 border-app flex flex-col items-center justify-center text-center focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--color-primary)] transition-colors ${
              highlighted
                ? "bg-[var(--zone-color)]/45"
                : isOverlap
                  ? "bg-[var(--zone-color)]/30"
                  : inWorkingHours
                    ? "bg-[var(--zone-color)]/15"
                    : "bg-surface"
            } ${crossesDay ? "border-l-2 border-l-[var(--color-border-strong)]" : ""}`}
            aria-label={`${cell.cell.hour}:${String(cell.cell.minute).padStart(2, "0")} in zone`}
          >
            <div
              className={`text-xs font-mono tabular-nums ${
                inWorkingHours ? "text-heading font-semibold" : "text-subtle"
              }`}
            >
              {formatHour(cell.cell.hour, cell.cell.minute, use24h)}
            </div>
            {dayChip && (
              <div
                className={`mt-0.5 text-[10px] leading-none px-1 py-0.5 rounded-sm font-semibold ${
                  cell.dayOffset > 0
                    ? "bg-amber-200 text-amber-900 dark:bg-amber-500/30 dark:text-amber-100"
                    : "bg-indigo-200 text-indigo-900 dark:bg-indigo-500/30 dark:text-indigo-100"
                }`}
              >
                {dayChip}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

function isWorkingHour(hour: number, wh: WorkingHours): boolean {
  if (wh.start <= wh.end) return hour >= wh.start && hour < wh.end;
  return hour >= wh.start || hour < wh.end;
}

function formatDayChip(dayOffset: number): string | null {
  if (dayOffset === 0) return null;
  if (dayOffset === 1) return "+1d";
  if (dayOffset === -1) return "-1d";
  return dayOffset > 0 ? `+${dayOffset}d` : `${dayOffset}d`;
}
