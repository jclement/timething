/**
 * ZoneEditor — modal dialog for editing a zone.
 *
 * Three attributes, one place:
 *   - Display name (user's label override)
 *   - Time zone (via typeahead — swaps the underlying IANA tz)
 *   - Working hours (always explicit; 8–17 is the baked-in default for
 *     new zones)
 *
 * Changes are collected in local draft state and applied on Save. Cancel,
 * backdrop click, and Escape all discard. Remove Zone sits in the footer
 * for zones the caller says are safe to delete (canRemove).
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
  workingHours: WorkingHours;
}

interface Props {
  open: boolean;
  zone: ZoneConfig;
  /** When false, the Remove Zone button is hidden (last zone must stay). */
  canRemove: boolean;
  onSave: (next: EditorResult) => void;
  onCancel: () => void;
  onRemove?: () => void;
}

export function ZoneEditor({ open, zone, canRemove, onSave, onCancel, onRemove }: Props) {
  const [tz, setTz] = useState(zone.tz);
  const [tzDisplay, setTzDisplay] = useState<string>(() => displayFor(zone.tz));
  const [label, setLabel] = useState(zone.label ?? "");
  const [wh, setWh] = useState<WorkingHours>(zone.workingHours);
  const dialogId = useId();

  // Re-seed the draft when the modal opens for a different zone.
  useEffect(() => {
    if (!open) return;
    setTz(zone.tz);
    setTzDisplay(displayFor(zone.tz));
    setLabel(zone.label ?? "");
    setWh(zone.workingHours);
  }, [open, zone]);

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
    onSave({ tz, label: label.trim(), workingHours: wh });
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
              Edit zone
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
              <label className="block text-xs font-medium text-subtle mb-1">
                Working hours
              </label>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted flex-shrink-0" />
                <HourInput
                  label="Start"
                  value={wh.start}
                  min={0}
                  max={23}
                  onChange={(n) => setWh({ ...wh, start: n })}
                />
                <span className="text-muted text-sm">–</span>
                <HourInput
                  label="End"
                  value={wh.end}
                  min={1}
                  max={24}
                  onChange={(n) => setWh({ ...wh, end: n })}
                />
              </div>
            </div>
          </div>

          <footer className="flex-shrink-0 flex items-center justify-between gap-2 px-5 py-3 border-t border-app bg-surface">
            <div>
              {canRemove && onRemove && (
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
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
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
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isNaN(n)) return;
          onChange(Math.max(min, Math.min(max, n)));
        }}
        className="h-9 px-2 border border-app rounded bg-surface text-sm text-heading font-mono outline-none focus:ring-1 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)]"
      />
    </label>
  );
}

function displayFor(tz: string): string {
  const city = firstCityForTz(tz);
  if (city) return `${city.name}, ${city.country}`;
  return humanizeIana(tz);
}
