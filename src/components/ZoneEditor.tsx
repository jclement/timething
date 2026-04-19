/**
 * ZoneEditor — modal dialog for editing a zone.
 *
 * Three attributes, one place:
 *   - Display name (user's label override)
 *   - Time zone (via typeahead — swaps the underlying IANA tz)
 *   - Working hours (always explicit; 8–17 is the baked-in default for
 *     new zones)
 *
 * Built on Headless UI's Dialog, which handles portal, focus trap,
 * Escape key, backdrop click, scroll lock, ARIA, and focus restore on
 * close. We just manage the draft state + render the fields.
 */

import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from "@headlessui/react";
import { Clock, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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
  const firstFieldRef = useRef<HTMLInputElement>(null);

  // Re-seed the draft when the modal opens for a different zone.
  useEffect(() => {
    if (!open) return;
    setTz(zone.tz);
    setTzDisplay(displayFor(zone.tz));
    setLabel(zone.label ?? "");
    setWh(zone.workingHours);
  }, [open, zone]);

  const handleSave = () => {
    onSave({ tz, label: label.trim(), workingHours: wh });
  };

  const handlePickTz = (hit: SearchHit) => {
    setTz(hit.tz);
    setTzDisplay(`${hit.name}${hit.country ? `, ${hit.country}` : ""}`);
    // If the user hadn't set a custom label, follow the new city's name.
    if (!label.trim()) setLabel(hit.name);
  };

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      initialFocus={firstFieldRef}
      className="no-print relative z-40"
    >
      <DialogBackdrop
        transition
        className="fixed inset-0 bg-black/40 duration-150 ease-out data-[closed]:opacity-0"
      />

      {/* `100dvh` wrapper keeps the panel within the visible viewport
       * when the mobile keyboard is up — Headless UI portals the dialog
       * but doesn't auto-resize for the on-screen keyboard. */}
      <div
        className="fixed inset-x-0 top-0 flex items-start sm:items-center justify-center px-3 sm:px-6 pt-3 pb-3 sm:py-6 overflow-y-auto"
        style={{ height: "100dvh" }}
      >
        <DialogPanel
          transition
          className="bg-surface border border-app rounded-lg shadow-xl w-full max-w-md flex flex-col max-h-full duration-150 ease-out data-[closed]:opacity-0 data-[closed]:scale-95"
        >
          <header className="flex-shrink-0 flex items-center justify-between px-5 py-3 border-b border-app">
            <DialogTitle className="text-sm font-semibold text-heading">
              Edit zone
            </DialogTitle>
            <button
              type="button"
              onClick={onCancel}
              aria-label="Close dialog"
              className="h-9 w-9 flex items-center justify-center text-muted hover:text-body hover:bg-hover rounded"
            >
              <X className="w-4 h-4" />
            </button>
          </header>

          <div className="flex-1 min-h-0 overflow-y-auto p-5 flex flex-col gap-4">
            {/* Name */}
            <div>
              <label
                htmlFor="zone-editor-name"
                className="block text-xs font-medium text-subtle mb-1"
              >
                Display name
              </label>
              <input
                id="zone-editor-name"
                ref={firstFieldRef}
                type="text"
                value={label}
                placeholder={tzDisplay}
                autoComplete="off"
                spellCheck={false}
                onChange={(e) => setLabel(e.target.value)}
                className="w-full h-10 px-2.5 border border-app rounded bg-surface text-base text-heading outline-none focus:ring-2 focus:ring-[var(--color-focus)] focus:border-[var(--color-focus)]"
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
        </DialogPanel>
      </div>
    </Dialog>
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
  // Track the raw draft separately so we don't clamp on every keystroke
  // (which makes a transient "23" flash when the user types "99").
  // Commit + clamp on blur.
  const [draft, setDraft] = useState(String(value));
  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const commit = () => {
    const n = Number(draft);
    if (Number.isNaN(n)) {
      setDraft(String(value));
      return;
    }
    const clamped = Math.max(min, Math.min(max, n));
    onChange(clamped);
    setDraft(String(clamped));
  };

  return (
    <input
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      maxLength={2}
      value={draft}
      onChange={(e) => setDraft(e.target.value.replace(/[^0-9]/g, ""))}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          (e.target as HTMLInputElement).blur();
        }
      }}
      aria-label={label}
      className="flex-1 min-w-0 h-10 px-2 border border-app rounded bg-surface text-base text-heading font-mono text-center outline-none focus:ring-2 focus:ring-[var(--color-focus)] focus:border-[var(--color-focus)]"
    />
  );
}

function displayFor(tz: string): string {
  const city = firstCityForTz(tz);
  if (city) return `${city.name}, ${city.country}`;
  return humanizeIana(tz);
}
