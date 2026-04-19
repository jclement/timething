/**
 * ZoneRow — one zone's line of 24 hour cells, plus the label column.
 *
 * The label lives in a sticky-left cell so it stays visible while the
 * user scrolls the hour grid horizontally on narrow screens.
 *
 * Working hours get a tinted background. Day boundaries get a thick
 * vertical divider and the "tomorrow"/"yesterday" cells get a subtle
 * diagonal stripe + day chip so the viewer instantly sees that 7am in
 * Calgary is actually "+1d 9pm" in Riyadh.
 */

import { Home, Pencil, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { computeDayOffset, formatHour } from "../lib/time";
import type { WorkingHours, ZoneConfig } from "../lib/storage";
import { firstCityForTz, humanizeIana, zoneAbbreviation } from "../lib/timezones";

interface Props {
  homeTz: string;
  /** Display label for the home zone (when this row is the home row). */
  homeLabel?: string;
  referenceDate: string;
  zone: ZoneConfig;
  isHome: boolean;
  defaultWorkingHours: WorkingHours;
  /** Color swatch index — stable across re-renders by config. */
  colorIndex: number;
  use24h: boolean;
  highlightedHomeHour: number | null;
  onHighlightHour: (hour: number | null) => void;
  /** Still accepted for API compatibility but unused now — edits live in ZoneEditor. */
  onWorkingHoursChange?: (next: WorkingHours | undefined) => void;
  onRemove?: () => void;
  onEdit?: () => void;
  onRename?: (label: string) => void;
  /** Hour range to show; start inclusive, end exclusive. */
  range: [number, number];
  /** Home-zone hours where every zone is inside working hours. */
  overlapHours: Set<number>;
}

export function ZoneRow({
  homeTz,
  homeLabel,
  referenceDate,
  zone,
  isHome,
  defaultWorkingHours,
  colorIndex,
  use24h,
  highlightedHomeHour,
  onHighlightHour,
  onRemove,
  onEdit,
  onRename,
  range,
  overlapHours,
}: Props) {
  const workingHours = zone.workingHours ?? defaultWorkingHours;

  // Build all the cells for this zone in one pass so we can find day
  // boundaries by comparing adjacent cells.
  const cells = useMemo(() => {
    const out: Array<ReturnType<typeof computeDayOffset> & { homeHour: number }> = [];
    for (let h = range[0]; h < range[1]; h++) {
      const c = computeDayOffset(homeTz, zone.tz, referenceDate, h);
      out.push({ ...c, homeHour: h });
    }
    return out;
  }, [homeTz, zone.tz, referenceDate, range]);

  const city = firstCityForTz(zone.tz);
  const effectiveLabel = isHome ? (homeLabel ?? zone.label) : zone.label;
  const display = effectiveLabel ?? city?.name ?? humanizeIana(zone.tz);
  const country = city?.country;
  const abbr = zoneAbbreviation(zone.tz);

  return (
    <div
      className="grid grid-cols-[minmax(180px,240px)_1fr] border-b border-app print-keep"
      style={{ ["--zone-color" as string]: `var(--zone-${colorIndex % 8})` }}
    >
      <ZoneLabel
        display={display}
        country={country}
        abbr={abbr}
        isHome={isHome}
        colorIndex={colorIndex}
        onEdit={onEdit}
        onRemove={onRemove}
        onRename={onRename}
      />

      <HourStrip
        cells={cells}
        workingHours={workingHours}
        highlightedHomeHour={highlightedHomeHour}
        onHighlightHour={onHighlightHour}
        use24h={use24h}
        referenceDate={referenceDate}
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
  isHome,
  colorIndex,
  onEdit,
  onRemove,
  onRename,
}: {
  display: string;
  country?: string;
  abbr: string;
  isHome: boolean;
  colorIndex: number;
  onEdit?: () => void;
  onRemove?: () => void;
  onRename?: (label: string) => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(display);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!renaming) setDraft(display);
  }, [display, renaming]);

  useEffect(() => {
    if (renaming) inputRef.current?.select();
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
    <div className="sticky left-0 z-10 bg-surface border-r border-app px-3 py-2 flex items-start gap-2 min-w-0">
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
              title="Click to rename"
            >
              {display}
            </button>
          )}
          {isHome && (
            <Home className="w-3.5 h-3.5 text-[var(--color-primary)] flex-shrink-0" />
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
  referenceDate,
  overlapHours,
}: {
  cells: Array<ReturnType<typeof computeDayOffset> & { homeHour: number }>;
  workingHours: WorkingHours;
  highlightedHomeHour: number | null;
  onHighlightHour: (hour: number | null) => void;
  use24h: boolean;
  referenceDate: string;
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
        const dayChip = formatDayChip(cell.dayOffset, cell.targetIsoDate, referenceDate);

        return (
          <button
            type="button"
            key={i}
            onClick={() =>
              onHighlightHour(highlightedHomeHour === cell.homeHour ? null : cell.homeHour)
            }
            className={`relative h-14 border-l first:border-l-0 border-app flex flex-col items-center justify-center text-center focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--color-primary)] transition-colors ${
              highlighted
                ? "bg-[var(--zone-color)]/30"
                : isOverlap
                  ? "bg-[var(--color-success)]/15"
                  : inWorkingHours
                    ? "bg-[var(--zone-color)]/15"
                    : "bg-surface"
            } ${crossesDay ? "border-l-2 border-l-[var(--color-border-strong)]" : ""}`}
            aria-label={`${cell.cell.hour}:${String(cell.cell.minute).padStart(2, "0")} in zone`}
          >
            {isOverlap && (
              <span
                aria-hidden="true"
                className="absolute inset-x-0 top-0 h-1 bg-[var(--color-success)]"
              />
            )}
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
  // Wraparound (e.g., 22-6). Treat as "hour >= start OR hour < end".
  return hour >= wh.start || hour < wh.end;
}

/**
 * Short day chip shown under times that fall on a different calendar date
 * than the reference. Renders "+1d" / "-1d" / "Sat" based on offset.
 */
function formatDayChip(
  dayOffset: number,
  _targetIsoDate: string,
  _referenceDate: string,
): string | null {
  if (dayOffset === 0) return null;
  if (dayOffset === 1) return "+1d";
  if (dayOffset === -1) return "-1d";
  if (dayOffset === 2) return "+2d";
  return dayOffset > 0 ? `+${dayOffset}d` : `${dayOffset}d`;
}
