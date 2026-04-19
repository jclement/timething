/**
 * WorkingHoursPopover — inline editor for a zone's working hours.
 * Portals the panel into <body> with fixed positioning so it escapes
 * ancestor overflow clipping (the dashboard's horizontally-scrolling
 * hour grid).
 */

import { Clock } from "lucide-react";
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { WorkingHours } from "../lib/storage";

interface Props {
  label?: string;
  value: WorkingHours;
  /** Whether this is an override (bold) or inheriting the default. */
  isOverride?: boolean;
  onChange: (next: WorkingHours) => void;
  onClear?: () => void;
  /** Compact icon-only trigger (used on mobile column headers). */
  compact?: boolean;
}

interface PanelPosition {
  top: number;
  left: number;
}

// Width of the panel (matches className w-56 — 14rem @ 16px base = 224px).
const PANEL_WIDTH = 224;
const VIEWPORT_MARGIN = 8;

export function WorkingHoursPopover({
  label,
  value,
  isOverride,
  onChange,
  onClear,
  compact,
}: Props) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<PanelPosition | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const id = useId();

  const updatePosition = useCallback(() => {
    const el = buttonRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();

    // Prefer right-aligning the panel under the button; clamp into viewport.
    let left = rect.right - PANEL_WIDTH;
    const maxLeft = window.innerWidth - PANEL_WIDTH - VIEWPORT_MARGIN;
    if (left < VIEWPORT_MARGIN) left = VIEWPORT_MARGIN;
    if (left > maxLeft) left = Math.max(VIEWPORT_MARGIN, maxLeft);

    setPosition({ top: rect.bottom + 4, left });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
    const handler = () => updatePosition();
    window.addEventListener("scroll", handler, true);
    window.addEventListener("resize", handler);
    return () => {
      window.removeEventListener("scroll", handler, true);
      window.removeEventListener("resize", handler);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        title={`Working hours: ${pad(value.start)}:00–${pad(value.end)}:00`}
        className={`inline-flex items-center gap-1.5 h-7 rounded border text-xs transition whitespace-nowrap ${
          compact ? "w-7 justify-center" : "px-2"
        } ${
          isOverride
            ? "border-[var(--color-primary)] text-[var(--color-primary)] font-medium"
            : "border-app text-subtle"
        } hover:bg-hover`}
        aria-label="Edit working hours"
      >
        <Clock className="w-3.5 h-3.5 flex-shrink-0" />
        {!compact && (
          <span className="font-mono whitespace-nowrap">
            {pad(value.start)}:00–{pad(value.end)}:00
          </span>
        )}
      </button>
      {open &&
        position &&
        createPortal(
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setOpen(false)}
              aria-hidden="true"
            />
            <div
              role="dialog"
              style={{ position: "fixed", top: position.top, left: position.left, zIndex: 50 }}
              className="bg-surface border border-app rounded-md shadow-lg p-3 w-56"
            >
              {label && <div className="text-xs text-muted mb-2">{label}</div>}
              <div className="flex items-center gap-2">
                <label htmlFor={`${id}-start`} className="text-xs text-subtle w-10">
                  Start
                </label>
                <input
                  id={`${id}-start`}
                  type="number"
                  min={0}
                  max={23}
                  value={value.start}
                  onChange={(e) => onChange({ ...value, start: clamp(+e.target.value, 0, 23) })}
                  className="flex-1 h-8 px-2 border border-app rounded bg-surface text-sm text-heading font-mono"
                />
              </div>
              <div className="flex items-center gap-2 mt-2">
                <label htmlFor={`${id}-end`} className="text-xs text-subtle w-10">
                  End
                </label>
                <input
                  id={`${id}-end`}
                  type="number"
                  min={1}
                  max={24}
                  value={value.end}
                  onChange={(e) => onChange({ ...value, end: clamp(+e.target.value, 1, 24) })}
                  className="flex-1 h-8 px-2 border border-app rounded bg-surface text-sm text-heading font-mono"
                />
              </div>
              {onClear && (
                <button
                  type="button"
                  className="mt-3 text-xs text-[var(--color-primary)] hover:underline"
                  onClick={() => {
                    onClear();
                    setOpen(false);
                  }}
                >
                  Reset to default
                </button>
              )}
            </div>
          </>,
          document.body,
        )}
    </>
  );
}

function pad(n: number) {
  return n < 10 ? `0${n}` : String(n);
}

function clamp(n: number, lo: number, hi: number) {
  if (Number.isNaN(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}
