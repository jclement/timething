/**
 * Dashboard — the app. Owns the list of zones, the reference date, and
 * the highlighted-hour state. Renders:
 *
 *   [Toolbar: reference date, hour range, export/print]
 *   [Hour axis in home zone]
 *   [Home zone row]
 *   [Additional zone rows…]
 *   [Search-box placeholder row for adding the next zone]
 *   [DST footnotes (print only)]
 *
 * Everything is persisted to localStorage via useSettings. No backend
 * state unless /api/pdf is used for export.
 */

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Clock, Pencil, Printer, Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { DstFootnotes } from "./DstFootnotes";
import { MobileGrid } from "./MobileGrid";
import { PageTitle } from "./PageTitle";
import { ReferenceDate } from "./ReferenceDate";
import { SortableZoneRow } from "./SortableZoneRow";
import { TopBar } from "./TopBar";
import { ValidityBar } from "./ValidityBar";
import { ZoneEditor, type EditorResult } from "./ZoneEditor";
import { ZoneSearch } from "./ZoneSearch";
import { useSettings } from "../hooks/useSettings";
import { computeOverlapHours, formatLongDate, todayInZone } from "../lib/time";
import { DEFAULT_WORKING_HOURS, makeZone } from "../lib/storage";
import { firstCityForTz, humanizeIana, resolveZoneName } from "../lib/timezones";
import { exportPdf } from "../lib/export";

// Range presets users cycle through. "Full day" is 0-24, "Waking" is
// 6-24 (a typical person's actionable window), "Work" is 7-19.
const RANGE_PRESETS: { key: "work" | "waking" | "full"; label: string; range: [number, number] }[] =
  [
    { key: "work", label: "Work hours", range: [7, 19] },
    { key: "waking", label: "Waking", range: [6, 24] },
    { key: "full", label: "Full day", range: [0, 24] },
  ];

export function Dashboard() {
  const { settings, update, saveAsDefault, needsSave } = useSettings();
  const primaryTz = settings.zones[0]?.tz ?? "UTC";
  const [referenceDate, setReferenceDate] = useState<string>(() => todayInZone(primaryTz));
  const [highlightedHour, setHighlightedHour] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const rangeKey = settings.rangeKey ?? "waking";
  const setRangeKey = (k: "work" | "waking" | "full") =>
    update((s) => ({ ...s, rangeKey: k }));
  const range = RANGE_PRESETS.find((r) => r.key === rangeKey)!.range;

  // When the primary (first) zone changes, re-anchor the reference date
  // to today in that zone so the grid stays sane.
  useEffect(() => {
    setReferenceDate(todayInZone(primaryTz));
  }, [primaryTz]);

  // Derived page title — comma-joined zone names. Used when the user
  // hasn't overridden `settings.title`.
  const derivedTitle = useMemo(
    () => settings.zones.map((z) => resolveZoneName(z)).join(", "),
    [settings.zones],
  );

  // Primary-zone hours (0-23) where every zone is inside its working
  // hours. Used to tint overlap cells a touch more intensely so the
  // "everyone's available" window reads at a glance.
  const overlapHours = useMemo(
    () =>
      computeOverlapHours(
        primaryTz,
        settings.zones.map((z) => ({ tz: z.tz, workingHours: z.workingHours })),
        referenceDate,
        range,
      ),
    [primaryTz, settings.zones, referenceDate, range],
  );

  // ---- Mutations -----------------------------------------------------------

  const addZone = (hit: { tz: string; name: string }) => {
    // Allow duplicates of tz? For now, no — but a rename is cheap if
    // the user really wants two entries for the same zone.
    if (settings.zones.some((z) => z.tz === hit.tz)) return;
    update((s) => ({ ...s, zones: [...s.zones, makeZone(hit.tz, hit.name)] }));
  };

  const removeZone = (id: string) => {
    // Keep at least one zone around — removing the last one would leave
    // the app in a non-renderable state.
    if (settings.zones.length <= 1) return;
    update((s) => ({ ...s, zones: s.zones.filter((z) => z.id !== id) }));
  };

  const renameZone = (id: string, label: string) => {
    const clean = label.trim();
    update((s) => ({
      ...s,
      zones: s.zones.map((z) => (z.id === id ? { ...z, label: clean || undefined } : z)),
    }));
  };

  const handleEditorSave = (id: string, next: EditorResult) => {
    const label = next.label || undefined;
    update((s) => ({
      ...s,
      zones: s.zones.map((z) =>
        z.id === id
          ? {
              ...z,
              tz: next.tz,
              label,
              workingHours: next.workingHours ?? DEFAULT_WORKING_HOURS,
            }
          : z,
      ),
    }));
    setEditingId(null);
  };

  const editingZone = editingId ? settings.zones.find((z) => z.id === editingId) : null;

  // ---- Export --------------------------------------------------------------

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportPdf({ settings, referenceDate, range });
    } finally {
      setExporting(false);
    }
  };

  // ---- Drag and drop -------------------------------------------------------

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = settings.zones.findIndex((z) => z.id === active.id);
    const newIndex = settings.zones.findIndex((z) => z.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    update((s) => ({ ...s, zones: arrayMove(s.zones, oldIndex, newIndex) }));
  };

  // ---- Render --------------------------------------------------------------

  return (
    <>
      <TopBar
        title={
          <PageTitle
            override={settings.title}
            derived={derivedTitle}
            onChange={(next) => update((s) => ({ ...s, title: next }))}
          />
        }
      >
        <ActionButtons
          onExport={handleExport}
          exporting={exporting}
          needsSave={needsSave}
          onSaveDefault={saveAsDefault}
        />
      </TopBar>
      <main className="flex-1 w-full max-w-[1600px] mx-auto px-3 sm:px-5 py-4 flex flex-col gap-3">
        <Toolbar
          referenceDate={referenceDate}
          onReferenceDate={setReferenceDate}
          onResetToday={() => setReferenceDate(todayInZone(primaryTz))}
          rangeKey={rangeKey}
          onRangeChange={setRangeKey}
          use24h={settings.use24h}
          onUse24hChange={(v) => update((s) => ({ ...s, use24h: v }))}
        />

        {settings.zones.length === 1 && <FirstRunHelp />}

        <PrintHeader primaryTz={primaryTz} referenceDate={referenceDate} />

        {/* Desktop: rows = zones, columns = hours. The first zone's row
         * doubles as the hour axis, so no separate axis row is rendered. */}
        <div className="hidden md:block bg-surface border border-app rounded-md shadow-sm overflow-x-auto">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={settings.zones.map((z) => z.id)}
              strategy={verticalListSortingStrategy}
            >
              {settings.zones.map((zone, i) => (
                <SortableZoneRow
                  key={zone.id}
                  primaryTz={primaryTz}
                  referenceDate={referenceDate}
                  zone={zone}
                  colorIndex={i}
                  use24h={settings.use24h}
                  highlightedHomeHour={highlightedHour}
                  onHighlightHour={setHighlightedHour}
                  onRemove={
                    settings.zones.length > 1 ? () => removeZone(zone.id) : undefined
                  }
                  onEdit={() => setEditingId(zone.id)}
                  onRename={(label) => renameZone(zone.id, label)}
                  range={range}
                  overlapHours={overlapHours}
                />
              ))}
            </SortableContext>
          </DndContext>
        </div>

        {/* Mobile: columns = zones, rows = hours. */}
        <div className="md:hidden">
          <MobileGrid
            primaryTz={primaryTz}
            referenceDate={referenceDate}
            zones={settings.zones}
            use24h={settings.use24h}
            range={range}
            highlightedHour={highlightedHour}
            onHighlightHour={setHighlightedHour}
            onEdit={(id) => setEditingId(id)}
            onReorder={(from, to) =>
              update((s) => ({ ...s, zones: arrayMove(s.zones, from, to) }))
            }
            overlapHours={overlapHours}
          />
        </div>

        <ValidityBar
          primaryTz={primaryTz}
          zones={settings.zones.map((z) => ({
            tz: z.tz,
            name: resolveZoneName(z),
          }))}
        />

        {/* Placeholder search — shared by both layouts. */}
        <div className="no-print">
          <ZoneSearch onSelect={(hit) => addZone(hit)} />
        </div>

        <DstFootnotes zones={settings.zones} />
      </main>

      {editingZone && (
        <ZoneEditor
          open={true}
          zone={editingZone}
          canRemove={settings.zones.length > 1}
          onSave={(next) => handleEditorSave(editingId!, next)}
          onCancel={() => setEditingId(null)}
          onRemove={
            settings.zones.length > 1
              ? () => {
                  removeZone(editingId!);
                  setEditingId(null);
                }
              : undefined
          }
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Toolbar({
  referenceDate,
  onReferenceDate,
  onResetToday,
  rangeKey,
  onRangeChange,
  use24h,
  onUse24hChange,
}: {
  referenceDate: string;
  onReferenceDate: (iso: string) => void;
  onResetToday: () => void;
  rangeKey: "work" | "waking" | "full";
  onRangeChange: (k: "work" | "waking" | "full") => void;
  use24h: boolean;
  onUse24hChange: (v: boolean) => void;
}) {
  // Cycle work -> waking -> full -> work, used by the mobile single-button variant.
  const nextRangeKey = (k: "work" | "waking" | "full"): "work" | "waking" | "full" =>
    k === "work" ? "waking" : k === "waking" ? "full" : "work";
  const currentLabel = RANGE_PRESETS.find((p) => p.key === rangeKey)!.label;

  return (
    <div className="no-print flex flex-wrap items-center gap-1.5 sm:gap-2">
      <ReferenceDate
        value={referenceDate}
        onChange={onReferenceDate}
        onResetToToday={onResetToday}
      />

      <div className="flex-1" />

      {/* Mobile: single cycle button. Desktop: three-segment control. */}
      <button
        type="button"
        onClick={() => onRangeChange(nextRangeKey(rangeKey))}
        title={`Range: ${currentLabel} (tap to cycle)`}
        className="sm:hidden inline-flex items-center gap-1.5 h-9 px-2.5 bg-surface border border-app text-subtle text-xs font-medium rounded-md hover:bg-hover"
      >
        <Clock className="w-3.5 h-3.5" />
        {currentLabel}
      </button>
      <div className="hidden sm:inline-flex rounded-md border border-app overflow-hidden">
        {RANGE_PRESETS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => onRangeChange(p.key)}
            className={`h-9 px-3 text-xs font-medium transition ${
              rangeKey === p.key
                ? "bg-[var(--color-primary)] text-white"
                : "bg-surface text-subtle hover:bg-hover"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* 12h / 24h clock format toggle. Single cycle button on mobile,
       * two-segment control on desktop. */}
      <button
        type="button"
        onClick={() => onUse24hChange(!use24h)}
        title={`Clock: ${use24h ? "24 hour" : "12 hour"} (tap to toggle)`}
        className="sm:hidden inline-flex items-center justify-center h-9 px-2.5 bg-surface border border-app text-subtle text-xs font-medium rounded-md hover:bg-hover"
      >
        {use24h ? "24h" : "12h"}
      </button>
      <div
        role="group"
        aria-label="Clock format"
        className="hidden sm:inline-flex rounded-md border border-app overflow-hidden"
      >
        {[
          { v: false, label: "12h" },
          { v: true, label: "24h" },
        ].map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => onUse24hChange(p.v)}
            className={`h-9 px-3 text-xs font-medium transition ${
              use24h === p.v
                ? "bg-[var(--color-primary)] text-white"
                : "bg-surface text-subtle hover:bg-hover"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function ActionButtons({
  onExport,
  exporting,
  needsSave,
  onSaveDefault,
}: {
  onExport: () => void;
  exporting: boolean;
  needsSave: boolean;
  onSaveDefault: () => void;
}) {
  return (
    <div className="no-print flex items-center gap-1.5">
      {needsSave && (
        <button
          type="button"
          onClick={onSaveDefault}
          title="Save current view as your default"
          aria-label="Save as default"
          className="inline-flex items-center gap-1.5 h-8 w-8 sm:w-auto sm:px-2.5 justify-center bg-surface border border-[var(--color-primary)]/40 text-[var(--color-primary)] text-xs font-medium rounded-md hover:bg-[var(--color-selected)]"
        >
          <Save className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Save default</span>
        </button>
      )}
      <button
        type="button"
        onClick={onExport}
        disabled={exporting}
        title={exporting ? "Exporting…" : "Export PDF"}
        aria-label="Export PDF"
        className="inline-flex items-center gap-1.5 h-8 w-8 sm:w-auto sm:px-2.5 justify-center bg-surface border border-app text-subtle text-xs font-medium rounded-md hover:bg-hover disabled:opacity-60"
      >
        <Printer className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">{exporting ? "Exporting…" : "Export PDF"}</span>
      </button>
    </div>
  );
}

function FirstRunHelp() {
  return (
    <div className="no-print bg-surface border border-app rounded-md shadow-sm p-4 text-sm text-body">
      <h2 className="text-sm font-semibold text-heading mb-1">
        Welcome — add a second zone to get started.
      </h2>
      <p className="text-xs text-muted mb-3">
        Type below: a city (Houston), a country (Saudi Arabia), an abbreviation (CST),
        or an IANA name (Pacific/Auckland).
      </p>
      <ul className="text-xs text-body space-y-1.5 list-disc pl-5">
        {/* Desktop variant */}
        <li className="hidden md:list-item">
          Click the{" "}
          <Pencil className="inline w-3 h-3 align-[-1px] mx-0.5" />
          <span className="font-medium">pencil</span> on a zone row to change the time
          zone, rename it, or set per-zone working hours. Click a name directly to
          rename it inline — "Jeff" instead of "Calgary".
        </li>
        <li className="hidden md:list-item">
          Drag the <span className="font-medium">grip handle</span> on the left to
          reorder rows. The top row drives the hour axis.
        </li>

        {/* Mobile variant */}
        <li className="md:hidden">
          Tap any <span className="font-medium">column header</span> to edit that zone —
          change the time zone, rename it, set working hours, or remove it. Drag the
          grip inside the header to reorder columns.
        </li>

        <li>
          Working hours get a tint in each zone's own color; hours when everyone is
          available get a darker tint.
        </li>
        <li>Click any hour cell to highlight that time across every zone.</li>
        <li>
          Your whole view lives in the URL — copy it from the address bar and send
          it to a colleague; they'll see the same grid.
        </li>
        <li>
          <span className="font-medium">Export PDF</span> gives you a landscape
          printout to tape next to your monitor. Just remember DST will nudge the
          whole thing twice a year — the PDF includes a "valid through" date.
        </li>
      </ul>
    </div>
  );
}

function PrintHeader({
  primaryTz,
  referenceDate,
}: {
  primaryTz: string;
  referenceDate: string;
}) {
  const city = firstCityForTz(primaryTz);
  return (
    <div className="print-only text-[#111827] mb-2">
      <div className="flex items-end justify-between border-b border-[#d1d5db] pb-2">
        <div>
          <div className="text-xs uppercase tracking-wider text-[#4b5563]">timething</div>
          <div className="text-lg font-semibold">
            Meeting times — {formatLongDate(referenceDate)}
          </div>
        </div>
        <div className="text-xs text-[#4b5563]">
          Primary: {city?.name ?? humanizeIana(primaryTz)} ({primaryTz})
        </div>
      </div>
    </div>
  );
}

