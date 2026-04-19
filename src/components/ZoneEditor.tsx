/**
 * ZoneEditor — modal dialog for editing a zone.
 *
 * Replaces the old inline "swap row for search" UI. All three attributes
 * of a zone are editable in one place:
 *   - Display label (the user's rename, e.g. "Jeff")
 *   - Time zone (via the typeahead — swaps the underlying IANA tz)
 *   - Working hours start/end (with a "use default" toggle on non-home
 *     zones; home zones edit the shared default)
 *
 * Changes are collected in local draft state and applied on Save; Cancel
 * discards. Escape + backdrop click also cancel.
 */

import { Clock, X } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import type { WorkingHours, ZoneConfig } from "../lib/storage";
import { firstCityForTz, humanizeIana, type SearchHit } from "../lib/timezones";
import { ZoneSearch } from "./ZoneSearch";

export interface EditorResult {
  tz: string;
  /** Empty string means "use the default city name." */
  label: string;
  /** null means inherit default; undefined only used for home (always set). */
  workingHours: WorkingHours | null;
}

interface Props {
  open: boolean;
  zone: ZoneConfig;
  isHome: boolean;
  defaultWorkingHours: WorkingHours;
  onSave: (next: EditorResult) => void;
  onCancel: () => void;
  onRemove?: () => void;
}

export function ZoneEditor({
  open,
  zone,
  isHome,
  defaultWorkingHours,
  onSave,
  onCancel,
  onRemove,
}: Props) {
  const initialWh = zone.workingHours ?? defaultWorkingHours;
  const [tz, setTz] = useState(zone.tz);
  const [tzDisplay, setTzDisplay] = useState<string>(() => displayFor(zone.tz));
  const [label, setLabel] = useState(zone.label ?? "");
  const [useDefault, setUseDefault] = useState(!zone.workingHours && !isHome);
  const [wh, setWh] = useState<WorkingHours>(initialWh);
  const dialogId = useId();

  // Re-seed the draft when the modal opens for a different zone.
  useEffect(() => {
    if (!open) return;
    setTz(zone.tz);
    setTzDisplay(displayFor(zone.tz));
    setLabel(zone.label ?? "");
    setUseDefault(!zone.workingHours && !isHome);
    setWh(zone.workingHours ?? defaultWorkingHours);
  }, [open, zone, defaultWorkingHours, isHome]);

  // Dismiss on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  const handleSave = () => {
    onSave({
      tz,
      label: label.trim(),
      workingHours: !isHome && useDefault ? null : wh,
    });
  };

  const handlePickTz = (hit: SearchHit) => {
    setTz(hit.tz);
    setTzDisplay(`${hit.name}${hit.country ? `, ${hit.country}` : ""}`);
    // If the user hadn't set a custom label, follow the new city's name.
    if (!label.trim()) setLabel(hit.name);
  };

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-40 bg-black/40"
        onClick={onCancel}
        aria-hidden="true"
      />
      {/* Outer wrapper uses dvh so the modal matches the *visible* viewport
       * when a mobile keyboard is up. Without this, inset-0 measures full
       * 100vh and the footer can hide behind the keyboard. */}
      <div
        className="fixed inset-x-0 top-0 z-40 flex items-start sm:items-center justify-center px-3 sm:px-6 pt-3 pb-3 sm:py-6"
        style={{ height: "100dvh" }}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${dialogId}-title`}
      >
        <div className="bg-surface border border-app rounded-lg shadow-xl w-full max-w-md flex flex-col max-h-full">
          <header className="flex-shrink-0 flex items-center justify-between px-5 py-3 border-b border-app">
            <h2 id={`${dialogId}-title`} className="text-sm font-semibold text-heading">
              {isHome ? "Edit home zone" : "Edit zone"}
            </h2>
            <button
              type="button"
              onClick={onCancel}
              aria-label="Close"
              className="h-7 w-7 flex items-center justify-center text-muted hover:text-body hover:bg-hover rounded"
            >
              <X className="w-4 h-4" />
            </button>
          </header>

          <div className="flex-1 min-h-0 overflow-y-auto p-5 flex flex-col gap-4">
            {/* Name */}
            <div>
              <label
                htmlFor={`${dialogId}-name`}
                className="block text-xs font-medium text-subtle mb-1"
              >
                Display name
              </label>
              <input
                id={`${dialogId}-name`}
                type="text"
                value={label}
                placeholder={tzDisplay}
                onChange={(e) => setLabel(e.target.value)}
                className="w-full h-9 px-2.5 border border-app rounded bg-surface text-sm text-heading outline-none focus:ring-1 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)]"
              />
              <p className="text-[11px] text-muted mt-1">
                Leave blank to use the city name.
              </p>
            </div>

            {/* Time zone */}
            <div>
              <label className="block text-xs font-medium text-subtle mb-1">
                Time zone
              </label>
              <div className="mb-1.5 text-xs text-body">
                Current: <span className="font-mono">{tz}</span>{" "}
                <span className="text-muted">· {tzDisplay}</span>
              </div>
              <ZoneSearch
                variant="edit"
                placeholder="Search for a city or zone to change…"
                onSelect={handlePickTz}
              />
            </div>

            {/* Working hours */}
            <div>
              <div className="flex items-baseline justify-between mb-1">
                <label className="block text-xs font-medium text-subtle">
                  Working hours
                </label>
                {!isHome && (
                  <label className="inline-flex items-center gap-1.5 text-[11px] text-muted cursor-pointer">
                    <input
                      type="checkbox"
                      checked={useDefault}
                      onChange={(e) => setUseDefault(e.target.checked)}
                      className="accent-[var(--color-primary)]"
                    />
                    Use default
                  </label>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted flex-shrink-0" />
                <HourInput
                  label="Start"
                  value={useDefault ? defaultWorkingHours.start : wh.start}
                  min={0}
                  max={23}
                  disabled={!isHome && useDefault}
                  onChange={(n) => setWh({ ...wh, start: n })}
                />
                <span className="text-muted text-sm">–</span>
                <HourInput
                  label="End"
                  value={useDefault ? defaultWorkingHours.end : wh.end}
                  min={1}
                  max={24}
                  disabled={!isHome && useDefault}
                  onChange={(n) => setWh({ ...wh, end: n })}
                />
              </div>
              {isHome && (
                <p className="text-[11px] text-muted mt-1">
                  This is also the default applied to new zones.
                </p>
              )}
            </div>
          </div>

          <footer className="flex-shrink-0 flex items-center justify-between gap-2 px-5 py-3 border-t border-app bg-surface">
            <div>
              {onRemove && (
                <button
                  type="button"
                  onClick={onRemove}
                  className="h-8 px-3 text-xs font-medium text-[var(--color-danger)] hover:bg-hover rounded"
                >
                  Remove zone
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onCancel}
                className="h-8 px-3 bg-surface border border-app text-body text-xs font-medium rounded hover:bg-hover"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="h-8 px-3 bg-[var(--color-primary)] text-white text-xs font-medium rounded hover:bg-[var(--color-primary-dark)]"
              >
                Save
              </button>
            </div>
          </footer>
        </div>
      </div>
    </>,
    document.body,
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function HourInput({
  label,
  value,
  min,
  max,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  disabled?: boolean;
  onChange: (n: number) => void;
}) {
  return (
    <label className="flex-1 flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-wider text-muted">{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        disabled={disabled}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isNaN(n)) return;
          onChange(Math.max(min, Math.min(max, n)));
        }}
        className="h-9 px-2 border border-app rounded bg-surface text-sm text-heading font-mono outline-none focus:ring-1 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)] disabled:opacity-50 disabled:bg-surface-alt"
      />
    </label>
  );
}

function displayFor(tz: string): string {
  const city = firstCityForTz(tz);
  if (city) return `${city.name}, ${city.country}`;
  return humanizeIana(tz);
}
