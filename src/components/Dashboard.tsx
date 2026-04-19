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

import { Check, Clock, Link2, Pencil, Printer, Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { DstFootnotes } from "./DstFootnotes";
import { MobileGrid } from "./MobileGrid";
import { ReferenceDate } from "./ReferenceDate";
import { TopBar } from "./TopBar";
import { ValidityBar } from "./ValidityBar";
import { ZoneEditor, type EditorResult } from "./ZoneEditor";
import { ZoneRow } from "./ZoneRow";
import { ZoneSearch } from "./ZoneSearch";
import { useSettings } from "../hooks/useSettings";
import { computeOverlapHours, formatLongDate, todayInZone } from "../lib/time";
import type { ZoneConfig } from "../lib/storage";
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
  const [referenceDate, setReferenceDate] = useState<string>(() => todayInZone(settings.homeTz));
  const [highlightedHour, setHighlightedHour] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [copied, setCopied] = useState(false);

  const rangeKey = settings.rangeKey ?? "waking";
  const setRangeKey = (k: "work" | "waking" | "full") =>
    update((s) => ({ ...s, rangeKey: k }));
  const range = RANGE_PRESETS.find((r) => r.key === rangeKey)!.range;

  // If the home zone changes (user picked a new one), re-anchor the
  // reference date to today in that zone so the grid stays sane.
  useEffect(() => {
    setReferenceDate(todayInZone(settings.homeTz));
  }, [settings.homeTz]);

  const allZones = useMemo<ZoneConfig[]>(
    () => [{ id: "__home__", tz: settings.homeTz }, ...settings.zones],
    [settings.homeTz, settings.zones],
  );

  // Home hours (0-23) where every zone is inside its working hours —
  // rendered as a green "everyone available" band across the grid.
  const overlapHours = useMemo(
    () =>
      computeOverlapHours(
        settings.homeTz,
        allZones.map((z) => ({
          tz: z.tz,
          workingHours: z.workingHours ?? settings.defaultWorkingHours,
        })),
        referenceDate,
        range,
      ),
    [settings.homeTz, allZones, settings.defaultWorkingHours, referenceDate, range],
  );

  // ---- Mutations -----------------------------------------------------------

  const addZone = (hit: { tz: string; name: string }) => {
    // Don't add duplicates — ignore if already present.
    if (hit.tz === settings.homeTz) return;
    if (settings.zones.some((z) => z.tz === hit.tz)) return;
    update((s) => ({
      ...s,
      zones: [...s.zones, { id: crypto.randomUUID(), tz: hit.tz, label: hit.name }],
    }));
  };

  const removeZone = (id: string) => {
    update((s) => ({ ...s, zones: s.zones.filter((z) => z.id !== id) }));
  };

  const renameZone = (id: string, label: string) => {
    const clean = label.trim();
    if (id === "__home__") {
      update((s) => ({ ...s, homeLabel: clean || undefined }));
    } else {
      update((s) => ({
        ...s,
        zones: s.zones.map((z) => (z.id === id ? { ...z, label: clean || undefined } : z)),
      }));
    }
  };

  const handleEditorSave = (id: string, next: EditorResult) => {
    const label = next.label || undefined;
    if (id === "__home__") {
      update((s) => ({
        ...s,
        homeTz: next.tz,
        homeLabel: label,
        defaultWorkingHours: next.workingHours ?? s.defaultWorkingHours,
        // Drop any zone that now duplicates the new home tz.
        zones: s.zones.filter((z) => z.tz !== next.tz),
      }));
    } else {
      update((s) => ({
        ...s,
        zones: s.zones.map((z) =>
          z.id === id
            ? { ...z, tz: next.tz, label, workingHours: next.workingHours ?? undefined }
            : z,
        ),
      }));
    }
    setEditingId(null);
  };

  const editingZone = editingId
    ? editingId === "__home__"
      ? { id: "__home__", tz: settings.homeTz, label: settings.homeLabel }
      : settings.zones.find((z) => z.id === editingId)
    : null;

  // ---- Export --------------------------------------------------------------

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportPdf({ settings, referenceDate, range });
    } finally {
      setExporting(false);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Older browsers: select + execCommand fallback is overkill for a
      // convenience feature — silently ignore, the URL is still visible.
    }
  };

  // ---- Render --------------------------------------------------------------

  return (
    <>
      <TopBar>
        <ActionButtons
          onExport={handleExport}
          exporting={exporting}
          onCopyLink={handleCopyLink}
          copied={copied}
          needsSave={needsSave}
          onSaveDefault={saveAsDefault}
        />
      </TopBar>
      <main className="flex-1 w-full max-w-[1600px] mx-auto px-3 sm:px-5 py-4 flex flex-col gap-3">
        <Toolbar
          referenceDate={referenceDate}
          onReferenceDate={setReferenceDate}
          onResetToday={() => setReferenceDate(todayInZone(settings.homeTz))}
          rangeKey={rangeKey}
          onRangeChange={setRangeKey}
        />

        {settings.zones.length === 0 && <FirstRunHelp />}

      <PrintHeader homeTz={settings.homeTz} referenceDate={referenceDate} />

      {/* Desktop: rows = zones, columns = hours. Hidden on small screens. */}
      <div className="hidden md:block bg-surface border border-app rounded-md shadow-sm overflow-x-auto">
        <HourAxis
          homeTz={settings.homeTz}
          range={range}
          use24h={settings.use24h}
          overlapHours={overlapHours}
        />
        {allZones.map((zone, i) => (
          <ZoneRow
            key={zone.id}
            homeTz={settings.homeTz}
            homeLabel={settings.homeLabel}
            referenceDate={referenceDate}
            zone={zone}
            isHome={zone.id === "__home__"}
            defaultWorkingHours={settings.defaultWorkingHours}
            colorIndex={i}
            use24h={settings.use24h}
            highlightedHomeHour={highlightedHour}
            onHighlightHour={setHighlightedHour}
            onRemove={zone.id === "__home__" ? undefined : () => removeZone(zone.id)}
            onEdit={() => setEditingId(zone.id)}
            onRename={(label) => renameZone(zone.id, label)}
            range={range}
            overlapHours={overlapHours}
          />
        ))}
      </div>

      {/* Mobile: columns = zones, rows = hours. Hidden on md+. */}
      <div className="md:hidden">
        <MobileGrid
          homeTz={settings.homeTz}
          homeLabel={settings.homeLabel}
          referenceDate={referenceDate}
          zones={allZones}
          defaultWorkingHours={settings.defaultWorkingHours}
          use24h={settings.use24h}
          range={range}
          highlightedHour={highlightedHour}
          onHighlightHour={setHighlightedHour}
          onEdit={(id) => setEditingId(id)}
          overlapHours={overlapHours}
        />
      </div>

      <ValidityBar
        homeTz={settings.homeTz}
        zones={allZones.map((z, i) => ({
          tz: z.tz,
          name: resolveZoneName(z, i === 0 ? settings.homeLabel : undefined),
        }))}
      />

      {/* Placeholder search — shared by both layouts. */}
      <div className="no-print">
        <ZoneSearch onSelect={(hit) => addZone(hit)} />
      </div>

      <DstFootnotes homeTz={settings.homeTz} zones={settings.zones} />
      </main>

      {editingZone && (
        <ZoneEditor
          open={true}
          zone={editingZone}
          isHome={editingId === "__home__"}
          defaultWorkingHours={settings.defaultWorkingHours}
          onSave={(next) => handleEditorSave(editingId!, next)}
          onCancel={() => setEditingId(null)}
          onRemove={
            editingId === "__home__"
              ? undefined
              : () => {
                  removeZone(editingId!);
                  setEditingId(null);
                }
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
}: {
  referenceDate: string;
  onReferenceDate: (iso: string) => void;
  onResetToday: () => void;
  rangeKey: "work" | "waking" | "full";
  onRangeChange: (k: "work" | "waking" | "full") => void;
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
    </div>
  );
}

function ActionButtons({
  onExport,
  exporting,
  onCopyLink,
  copied,
  needsSave,
  onSaveDefault,
}: {
  onExport: () => void;
  exporting: boolean;
  onCopyLink: () => void;
  copied: boolean;
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
        onClick={onCopyLink}
        title="Copy shareable link"
        aria-label="Copy link"
        className="inline-flex items-center gap-1.5 h-8 w-8 sm:w-auto sm:px-2.5 justify-center bg-surface border border-app text-subtle text-xs font-medium rounded-md hover:bg-hover"
      >
        {copied ? (
          <Check className="w-3.5 h-3.5 text-[var(--color-success)]" />
        ) : (
          <Link2 className="w-3.5 h-3.5" />
        )}
        <span className="hidden sm:inline">{copied ? "Copied" : "Copy link"}</span>
      </button>
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
          zone, rename it, or set custom working hours.
        </li>
        <li className="hidden md:list-item">
          Click a zone name directly to rename it inline — "Jeff" instead of "Calgary".
        </li>

        {/* Mobile variant */}
        <li className="md:hidden">
          Tap any <span className="font-medium">column header</span> to edit that zone —
          change the time zone, rename it ("Jeff" instead of "Calgary"), set working
          hours, or remove it.
        </li>

        <li>
          A <span className="text-[var(--color-success)] font-semibold">green bar</span>{" "}
          marks hours when everyone is inside their working window.
        </li>
        <li>
          Click any hour cell to highlight that time across every zone.
        </li>
        <li>
          <span className="font-medium">Copy link</span> captures your whole view in
          the URL — send it to a colleague, they see the same grid.
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

function PrintHeader({ homeTz, referenceDate }: { homeTz: string; referenceDate: string }) {
  const city = firstCityForTz(homeTz);
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
          Home: {city?.name ?? humanizeIana(homeTz)} ({homeTz})
        </div>
      </div>
    </div>
  );
}

function HourAxis({
  homeTz: _homeTz,
  range,
  use24h,
  overlapHours,
}: {
  homeTz: string;
  range: [number, number];
  use24h: boolean;
  overlapHours: Set<number>;
}) {
  const hours = [];
  for (let h = range[0]; h < range[1]; h++) hours.push(h);
  return (
    <div className="grid grid-cols-[minmax(180px,240px)_1fr] bg-surface-alt border-b-2 border-app-strong">
      <div className="px-3 py-2" />

      <div
        className="grid"
        style={{ gridTemplateColumns: `repeat(${hours.length}, minmax(44px, 1fr))` }}
      >
        {hours.map((h) => {
          const overlap = overlapHours.has(h);
          return (
            <div
              key={h}
              className={`h-8 border-l first:border-l-0 border-app flex items-center justify-center text-[11px] font-mono tabular-nums ${
                overlap ? "text-[var(--color-success)] font-semibold" : "text-subtle"
              }`}
            >
              {labelForHomeHour(h, use24h)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function labelForHomeHour(h: number, use24h: boolean): string {
  if (use24h) return `${h.toString().padStart(2, "0")}`;
  if (h === 0) return "12a";
  if (h === 12) return "12p";
  if (h < 12) return `${h}a`;
  return `${h - 12}p`;
}
