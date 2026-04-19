/**
 * MobileGrid — narrow-viewport layout.
 *
 * Columns are zones (first = primary, drives the hour axis via its own
 * body cells — no separate axis column). Rows stack vertically, one per
 * primary-zone hour. Column headers open the ZoneEditor on tap.
 *
 * Non-primary columns are sortable via a small grip inside the header.
 */

import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
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
  primaryTz: string;
  referenceDate: string;
  /** All zones; the first is the primary and drives the hour labels. */
  zones: ZoneConfig[];
  use24h: boolean;
  range: [number, number];
  highlightedHour: number | null;
  onHighlightHour: (h: number | null) => void;
  onEdit: (id: string) => void;
  /** Called when the user drops a column. Indices are 0-based into the
   * non-primary subset of zones (i.e., zones.slice(1)). */
  onReorder?: (fromIndex: number, toIndex: number) => void;
  overlapHours: Set<number>;
}

export function MobileGrid({
  primaryTz,
  referenceDate,
  zones,
  use24h,
  range,
  highlightedHour,
  onHighlightHour,
  onEdit,
  onReorder,
  overlapHours,
}: Props) {
  const hours = useMemo(() => {
    const out: number[] = [];
    for (let h = range[0]; h < range[1]; h++) out.push(h);
    return out;
  }, [range]);

  const sensors = useSensors(
    // Mouse drag activates on 4px movement.
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    // Touch drag uses press-and-hold so it doesn't fight the horizontal
    // scroll. 250ms is the sweet spot: short enough to feel responsive,
    // long enough that flick-scrolls don't accidentally pick up a zone.
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    if (!onReorder) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = zones.findIndex((z) => z.id === active.id);
    const to = zones.findIndex((z) => z.id === over.id);
    if (from < 0 || to < 0) return;
    onReorder(from, to);
  };

  const zoneIds = zones.map((z) => z.id);

  const grid = useMemo(
    () =>
      zones.map((zone) =>
        hours.map((h) => computeDayOffset(primaryTz, zone.tz, referenceDate, h)),
      ),
    [zones, hours, primaryTz, referenceDate],
  );

  return (
    <div className="bg-surface border border-app rounded-md shadow-sm overflow-x-auto">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={zoneIds} strategy={horizontalListSortingStrategy}>
          <div className="flex border-b border-app-strong bg-surface-alt sticky top-0 z-10">
            {zones.map((zone, i) => (
              <SortableColumnHeader
                key={zone.id}
                zone={zone}
                color={ZONE_COLORS[i % ZONE_COLORS.length]}
                onEdit={() => onEdit(zone.id)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {/* Body — one row per primary-zone hour */}
      {hours.map((h, hi) => {
        const highlighted = highlightedHour === h;
        const isOverlap = overlapHours.has(h);
        return (
          <div key={h} className="flex border-b border-app last:border-b-0">
            {zones.map((zone, zi) => {
              const cell = grid[zi][hi];
              const prev = grid[zi][hi - 1];
              const crossesDay = prev && prev.dayOffset !== cell.dayOffset;
              const inWorking = isWorkingHour(cell.cell.hour, zone.workingHours);
              const color = ZONE_COLORS[zi % ZONE_COLORS.length];
              const dayChip = formatDayChip(cell.dayOffset);

              return (
                <button
                  type="button"
                  key={zone.id}
                  onClick={() => onHighlightHour(highlighted ? null : h)}
                  className={`flex-1 min-w-[80px] px-1 py-1.5 border-r last:border-r-0 border-app ${
                    crossesDay ? "border-t border-t-[var(--color-border-strong)]" : ""
                  } focus:outline-none flex items-center justify-center gap-1`}
                  style={{
                    backgroundColor: highlighted
                      ? hexWithAlpha(color, 0.45)
                      : isOverlap && inWorking
                        ? hexWithAlpha(color, 0.3)
                        : inWorking
                          ? hexWithAlpha(color, 0.15)
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
                      className={`text-[10px] leading-none inline-block px-1 py-0.5 rounded-sm font-semibold ${
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
// ---------------------------------------------------------------------------

interface ColumnHeaderProps {
  zone: ZoneConfig;
  color: string;
  onEdit: () => void;
  /** Optional grip button rendered before the swatch (set by the sortable wrapper). */
  dragHandle?: React.ReactNode;
}

function ColumnHeader({ zone, color, onEdit, dragHandle }: ColumnHeaderProps) {
  const city = firstCityForTz(zone.tz);
  const display = zone.label ?? city?.name ?? humanizeIana(zone.tz);
  const abbr = zoneAbbreviation(zone.tz);

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Edit ${display}`}
      onClick={onEdit}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onEdit();
        }
      }}
      className="flex-1 min-w-[80px] px-1.5 py-2 border-r last:border-r-0 border-app hover:bg-hover focus:outline-none focus:ring-1 focus:ring-inset focus:ring-[var(--color-primary)] cursor-pointer"
    >
      <div className="flex items-start gap-1">
        {dragHandle}
        <span
          aria-hidden="true"
          className="inline-block w-2 h-2 rounded-sm mt-1 flex-shrink-0"
          style={{ background: color }}
        />
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold text-heading truncate" title={display}>
            {display}
          </div>
          <div className="text-[10px] text-muted font-mono truncate">{abbr}</div>
        </div>
      </div>
    </div>
  );
}

function SortableColumnHeader(props: Omit<ColumnHeaderProps, "dragHandle">) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: props.zone.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 20 : undefined,
  };

  // Keep the button visually aligned with the swatch/title row:
  // items-start + a tiny top padding pins the icon near the top of the
  // 28px tap target instead of centering it.
  const handle = (
    <button
      type="button"
      aria-label="Reorder column"
      className="flex-shrink-0 h-7 w-7 flex items-start justify-center pt-[3px] text-muted hover:text-body rounded cursor-grab active:cursor-grabbing touch-none"
      {...attributes}
      {...listeners}
      onClick={(e) => e.stopPropagation()}
    >
      <GripVertical className="w-3.5 h-3.5" />
    </button>
  );

  return (
    <div ref={setNodeRef} style={style} className="flex-1 min-w-[80px] flex">
      <ColumnHeader {...props} dragHandle={handle} />
    </div>
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
